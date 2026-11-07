/**
 * Slice 2.6: CreateDisbursement use case — creates the Beneficiary and
 * Disbursement rows starting at planStatus DRAFT / paymentStatus
 * NOT_SENT (spec §6 Step 1). Repositories are mocked; no DB here.
 */
import { describe, expect, it, beforeEach } from "vitest";
import { CreateDisbursement } from "./create-disbursement";
import type { DisbursementRecord, LedgerEventRecord, PlanVersionRecord } from "@/application/ports/db";

beforeEach(() => {
  process.env.APP_ENCRYPTION_KEY = "a".repeat(64);
});

function stubRepos() {
  const created: {
    beneficiary?: unknown;
    disbursement?: unknown;
    planVersion?: unknown;
    planItems?: unknown[];
    ledgerEvent?: unknown;
  } = {};
  const users = {
    findById: async () => ({
      id: "coord-1",
      organizationId: "org-1",
      name: "Alex Morgan",
      email: "alex.morgan@example.com",
      passwordHash: null,
      role: "COORDINATOR" as const,
      createdAt: new Date(),
      updatedAt: new Date(),
    }),
    create: async () => { throw new Error("unused"); },
  };
  const beneficiaries = {
    create: async (input: unknown) => {
      created.beneficiary = input;
      return {
        id: "beneficiary-1",
        organizationId: "org-1",
        displayName: (input as { displayName: string }).displayName,
        invitationEmail: (input as { invitationEmail: string }).invitationEmail,
        encryptedPayPalRecipient: (input as { encryptedPayPalRecipient: string }).encryptedPayPalRecipient,
        preferredLanguage: (input as { preferredLanguage: "en" }).preferredLanguage,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    },
    findById: async () => { throw new Error("unused"); },
  };
  const disbursements = {
    create: async (input: unknown) => {
      created.disbursement = input;
      return {
        id: "disbursement-1",
        createdAt: new Date(),
        updatedAt: new Date(),
        ...(input as object),
      } as unknown as DisbursementRecord;
    },
    findById: async () => { throw new Error("unused"); },
    findByPublicReference: async () => { throw new Error("unused"); },
    updatePlanStatus: async () => { throw new Error("unused"); },
  };
  const plans = {
    create: async (input: unknown) => {
      created.planVersion = input;
      return {
        id: "pv-1",
        createdAt: new Date(),
        ...(input as object),
      } as unknown as PlanVersionRecord;
    },
    createItems: async (items: unknown[]) => {
      created.planItems = items;
      return items as never;
    },
    findLatestByDisbursementId: async () => { throw new Error("unused"); },
    findItemsByVersionId: async () => [],
  };
  const ledger = {
    create: async (input: unknown) => {
      created.ledgerEvent = input;
      return { id: "le-1", createdAt: new Date(), ...(input as object) } as unknown as LedgerEventRecord;
    },
  };
  return { created, users, beneficiaries, disbursements, plans, ledger };
}

const INPUT = {
  coordinatorId: "coord-1",
  beneficiary: {
    displayName: "Priya Raman",
    invitationEmail: "priya@example.com",
    payPalRecipientEmail: "priya.paypal@example.com",
    preferredLanguage: "en" as const,
  },
  amountText: "500.00",
  currency: "USD",
  supportNote: "Please allocate $300 for rent",
  shareSupportNoteWithBeneficiary: true,
};

describe("CreateDisbursement (Slice 2.6)", () => {
  it("creates a beneficiary and a DRAFT/NOT_SENT disbursement", async () => {
    const repos = stubRepos();
    const useCase = new CreateDisbursement(repos.users, repos.beneficiaries, repos.disbursements, repos.plans, repos.ledger);
    const result = await useCase.execute(INPUT);

    expect(result.planStatus).toBe("DRAFT");
    expect(result.paymentStatus).toBe("NOT_SENT");
    expect(result.amountMinor).toBe(50000n);
    expect(result.beneficiaryId).toBe("beneficiary-1");
    expect(result.publicReference).toMatch(/^FL-[A-Z0-9]{8}$/);
  });

  it("stores the PayPal recipient encrypted, never as plaintext", async () => {
    const repos = stubRepos();
    const useCase = new CreateDisbursement(repos.users, repos.beneficiaries, repos.disbursements, repos.plans, repos.ledger);
    await useCase.execute(INPUT);
    const beneficiary = repos.created.beneficiary as { encryptedPayPalRecipient: string };
    expect(beneficiary.encryptedPayPalRecipient).not.toContain("priya.paypal@example.com");
  });

  it("rejects a coordinator without an organization", async () => {
    const repos = stubRepos();
    repos.users.findById = (async () => ({
      id: "coord-2",
      organizationId: null,
      name: "No Org",
      email: "noorg@example.com",
      passwordHash: null,
      role: "COORDINATOR" as const,
      createdAt: new Date(),
      updatedAt: new Date(),
    })) as unknown as typeof repos.users.findById;
    const useCase = new CreateDisbursement(repos.users, repos.beneficiaries, repos.disbursements, repos.plans, repos.ledger);
    await expect(useCase.execute({ ...INPUT, coordinatorId: "coord-2" })).rejects.toThrow(/no organization/i);
  });
});

describe("CreateDisbursement plan persistence (Slice 2.7)", () => {
  it("rejects a plan that exceeds the disbursement total (before any write)", async () => {
    const repos = stubRepos();
    const useCase = new CreateDisbursement(repos.users, repos.beneficiaries, repos.disbursements, repos.plans, repos.ledger);
    await expect(
      useCase.execute({
        ...INPUT,
        plan: {
          summary: "Over",
          items: [
            { category: "Rent", amountText: "400.00" },
            { category: "Food", amountText: "200.00" },
          ],
        },
      }),
    ).rejects.toThrow(/exceed/i);
    expect(repos.created.disbursement).toBeUndefined();
    expect(repos.created.planVersion).toBeUndefined();
  });

  it("sets unallocatedMinor when the plan is under the total", async () => {
    const repos = stubRepos();
    const useCase = new CreateDisbursement(repos.users, repos.beneficiaries, repos.disbursements, repos.plans, repos.ledger);
    await useCase.execute({
      ...INPUT,
      plan: { summary: "Under", items: [{ category: "Rent", amountText: "200.00", evidenceText: "$200 for rent" }] },
    });
    const version = repos.created.planVersion as { totalAllocatedMinor: bigint; unallocatedMinor: bigint };
    expect(version.totalAllocatedMinor).toBe(20000n);
    expect(version.unallocatedMinor).toBe(30000n);
  });

  it("plan versions are immutable: the repository exposes no update or delete operation", () => {
    const repos = stubRepos();
    expect("update" in repos.plans).toBe(false);
    expect("delete" in repos.plans).toBe(false);
  });

  it("writes a LedgerEvent row when the plan is saved", async () => {
    const repos = stubRepos();
    const useCase = new CreateDisbursement(repos.users, repos.beneficiaries, repos.disbursements, repos.plans, repos.ledger);
    await useCase.execute({
      ...INPUT,
      plan: { summary: "P", items: [{ category: "Rent", amountText: "200.00" }] },
    });
    const event = repos.created.ledgerEvent as {
      disbursementId: string;
      actorType: string;
      actorId: string;
      eventType: string;
      payloadJson: string;
    };
    expect(event.actorType).toBe("COORDINATOR");
    expect(event.actorId).toBe("coord-1");
    expect(event.eventType).toBe("PLAN_VERSION_CREATED");
    const payload = JSON.parse(event.payloadJson) as { versionNumber: number; itemCount: number };
    expect(payload.versionNumber).toBe(1);
    expect(payload.itemCount).toBe(1);
  });
});
