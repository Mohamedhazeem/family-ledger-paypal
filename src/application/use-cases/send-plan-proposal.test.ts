/**
 * SendPlanProposal use case: delivers the LATEST plan version to the
 * beneficiary's invitation email and always returns the copyable link.
 * Repositories and the email port are stubbed; no DB here.
 */
import { describe, expect, it } from "vitest";
import { SendPlanProposal } from "./send-plan-proposal";
import type { CreateInvitation } from "./create-invitation";
import type {
  BeneficiaryRepository,
  DisbursementRecord,
  DisbursementRepository,
  LedgerEventInput,
  OrganizationRepository,
  PlanVersionRecord,
  PlanVersionRepository,
} from "@/application/ports/db";
import type { EmailPort, PlanProposalEmailData } from "@/application/ports/email";

function makeDisbursement(overrides: Partial<DisbursementRecord> = {}): DisbursementRecord {
  return {
    id: "d-1",
    publicReference: "FL-TEST-001",
    organizationId: "org-1",
    coordinatorId: "coord-1",
    beneficiaryId: "b-1",
    amountMinor: 50000n,
    currency: "USD",
    supportNote: "support note",
    shareSupportNoteWithBeneficiary: false,
    planStatus: "DRAFT",
    paymentStatus: "NOT_SENT",
    paypalPayoutBatchId: null,
    paypalPayoutItemId: null,
    paypalBatchStatus: null,
    paypalItemStatus: null,
    paymentMode: "SANDBOX",
    deletedAt: null,
    createdAt: new Date(0),
    updatedAt: new Date(0),
    ...overrides,
  };
}

function stubDeps(disbursement: DisbursementRecord, version: PlanVersionRecord | null) {
  const disbursements = {
    findById: async () => disbursement,
  } as unknown as DisbursementRepository;
  const beneficiaries = {
    findById: async () => ({
      id: "b-1",
      displayName: "Priya Raman",
      invitationEmail: "priya@example.com",
    }),
  } as unknown as BeneficiaryRepository;
  const organizations = {
    findById: async () => ({ id: "org-1", name: "Programme" }),
  } as unknown as OrganizationRepository;
  const plans = {
    findLatestByDisbursementId: async () => version,
    findItemsByVersionId: async () =>
      version
        ? [
            { id: "pi-1", category: "Rent", amountMinor: 30000n },
            { id: "pi-2", category: "Food", amountMinor: null },
          ]
        : [],
  } as unknown as PlanVersionRepository;
  const events: LedgerEventInput[] = [];
  const ledger = {
    create: async (input: LedgerEventInput) => {
      events.push(input);
      return { id: `evt-${events.length}`, createdAt: new Date(0), ...input };
    },
  };
  return { disbursements, beneficiaries, organizations, plans, ledger, events };
}

function fakeCreateInvitation(calls: number[]) {
  return {
    execute: async () => {
      calls.push(1);
      return {
        invitationId: "inv-new",
        token: "token-abc",
        expiresAt: new Date("2026-11-18T00:00:00.000Z"),
      };
    },
  } as unknown as CreateInvitation;
}

function makeUseCase(
  deps: ReturnType<typeof stubDeps>,
  invitationCalls: number[],
  email?: { data?: PlanProposalEmailData; result?: { delivered: boolean; provider: string; error?: string } },
) {
  const sent: PlanProposalEmailData[] = [];
  const emailPort: EmailPort = {
    send: async () => ({ delivered: false, provider: "stub" }),
    sendPlanProposal: async (data: PlanProposalEmailData) => {
      sent.push(data);
      return email?.result ?? { delivered: true, provider: "stub" };
    },
  };
  const useCase = new SendPlanProposal(
    deps.disbursements,
    deps.beneficiaries,
    deps.organizations,
    deps.plans,
    deps.ledger as never,
    emailPort,
    fakeCreateInvitation(invitationCalls),
  );
  return { useCase, sent };
}

const VERSION: PlanVersionRecord = {
  id: "pv-1",
  disbursementId: "d-1",
  versionNumber: 1,
  createdByType: "COORDINATOR",
  createdById: "coord-1",
  summary: "v1",
  explanation: null,
  status: "DRAFT",
  totalAllocatedMinor: 30000n,
  unallocatedMinor: 20000n,
  requiresClarification: false,
  createdAt: new Date(0),
};

const INPUT = { coordinatorId: "coord-1", disbursementId: "d-1", appUrl: "https://app.example.com/" };

describe("SendPlanProposal", () => {
  it("emails the latest plan version and returns the link plus delivery outcome", async () => {
    const deps = stubDeps(makeDisbursement(), VERSION);
    const calls: number[] = [];
    const { useCase, sent } = makeUseCase(deps, calls);

    const result = await useCase.execute(INPUT);

    expect(calls).toHaveLength(1);
    expect(result.url).toBe("https://app.example.com/beneficiary/token-abc");
    expect(result.delivered).toBe(true);
    expect(result.provider).toBe("stub");
    expect(result.planVersionNumber).toBe(1);
    expect(sent).toHaveLength(1);
    expect(sent[0]!.to).toBe("priya@example.com");
    expect(sent[0]!.amountMinor).toBe(50000n);
    expect(sent[0]!.items).toEqual([
      { category: "Rent", amountMinor: 30000n },
      { category: "Food", amountMinor: null },
    ]);
    expect(sent[0]!.unallocatedMinor).toBe(20000n);
    expect(sent[0]!.url).toBe(result.url);
  });

  it("logs PLAN_PROPOSAL_SENT without the support note", async () => {
    const deps = stubDeps(makeDisbursement(), VERSION);
    const { useCase } = makeUseCase(deps, []);

    await useCase.execute(INPUT);

    const event = deps.events.find((e) => e.eventType === "PLAN_PROPOSAL_SENT");
    expect(event).toBeDefined();
    const payload = JSON.parse(event!.payloadJson) as Record<string, unknown>;
    expect(payload.invitationId).toBe("inv-new");
    expect(payload.planVersionNumber).toBe(1);
    expect(payload.delivered).toBe(true);
    expect(event!.payloadJson).not.toContain("support note");
  });

  it("blocks a coordinator who does not own the disbursement", async () => {
    const deps = stubDeps(makeDisbursement(), VERSION);
    const { useCase } = makeUseCase(deps, []);

    await expect(
      useCase.execute({ ...INPUT, coordinatorId: "coord-2" }),
    ).rejects.toThrow("Not your disbursement.");
  });

  it("blocks a deleted disbursement", async () => {
    const deps = stubDeps(makeDisbursement({ deletedAt: new Date(1) }), VERSION);
    const { useCase } = makeUseCase(deps, []);

    await expect(useCase.execute(INPUT)).rejects.toThrow("Disbursement not found.");
  });

  it("blocks sending when no plan version exists", async () => {
    const deps = stubDeps(makeDisbursement(), null);
    const calls: number[] = [];
    const { useCase } = makeUseCase(deps, calls);

    await expect(useCase.execute(INPUT)).rejects.toThrow(/create a plan/i);
    expect(calls).toHaveLength(0);
  });

  it("surfaces the provider error when delivery fails", async () => {
    const deps = stubDeps(makeDisbursement(), VERSION);
    const { useCase } = makeUseCase(deps, [], {
      result: { delivered: false, provider: "resend", error: "Invalid `to` field." },
    });

    const result = await useCase.execute(INPUT);

    expect(result.delivered).toBe(false);
    expect(result.provider).toBe("resend");
    expect(result.error).toBe("Invalid `to` field.");
  });
});
