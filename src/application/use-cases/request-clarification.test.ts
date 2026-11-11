/**
 * RequestClarification (spec §6 Step 7, ADR-0019): the coordinator asks
 * one question; the latest unanswered one is shown in the portal.
 */
import { describe, expect, it } from "vitest";
import { RequestClarification } from "./request-clarification";
import type {
  DisbursementRecord,
  LedgerEventInput,
  PlanClarificationRecord,
} from "@/application/ports/db";

function makeDisbursement(overrides: Partial<DisbursementRecord> = {}): DisbursementRecord {
  return {
    id: "d-1",
    publicReference: "FL-CLAR-001",
    organizationId: "org-1",
    coordinatorId: "coord-1",
    beneficiaryId: "b-1",
    amountMinor: 50000n,
    currency: "USD",
    supportNote: "note",
    shareSupportNoteWithBeneficiary: false,
    planStatus: "REVISION_PROPOSED",
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

function stubDeps(disbursement: DisbursementRecord) {
  const created: PlanClarificationRecord[] = [];
  const events: LedgerEventInput[] = [];
  const disbursements = { findById: async () => disbursement };
  const clarifications = {
    create: async (input: { disbursementId: string; question: string }) => {
      const record: PlanClarificationRecord = {
        id: `clar-${created.length + 1}`,
        createdByType: "COORDINATOR",
        createdById: "coord-1",
        respondedAt: null,
        createdAt: new Date(0),
        ...input,
      };
      created.push(record);
      return record;
    },
  };
  const ledger = {
    create: async (input: LedgerEventInput) => {
      events.push(input);
      return { id: `evt-${events.length}`, createdAt: new Date(0), ...input };
    },
  };
  return { disbursements, clarifications, ledger, created, events };
}

function makeUseCase(deps: ReturnType<typeof stubDeps>) {
  return new RequestClarification(
    deps.disbursements as never,
    deps.clarifications as never,
    deps.ledger as never,
  );
}

const INPUT = {
  coordinatorId: "coord-1",
  disbursementId: "d-1",
  question: "Could you tell us more about the transport costs?",
};

describe("RequestClarification (spec §6 Step 7)", () => {
  it("stores the question and logs PLAN_CLARIFICATION_REQUESTED", async () => {
    const deps = stubDeps(makeDisbursement());
    const result = await makeUseCase(deps).execute(INPUT);

    expect(result.question).toBe(INPUT.question);
    expect(deps.created).toHaveLength(1);
    expect(deps.events.map((e) => e.eventType)).toEqual(["PLAN_CLARIFICATION_REQUESTED"]);
    expect(deps.events[0]!.payloadJson).not.toContain("transport costs");
  });

  it("trims the question", async () => {
    const deps = stubDeps(makeDisbursement());
    const result = await makeUseCase(deps).execute({ ...INPUT, question: "  Hello?  " });
    expect(result.question).toBe("Hello?");
  });

  it("rejects an empty question", async () => {
    const deps = stubDeps(makeDisbursement());
    await expect(makeUseCase(deps).execute({ ...INPUT, question: "   " })).rejects.toThrow(
      /enter a question/i,
    );
    expect(deps.created).toHaveLength(0);
  });

  it("blocks a coordinator who does not own the disbursement", async () => {
    const deps = stubDeps(makeDisbursement());
    await expect(
      makeUseCase(deps).execute({ ...INPUT, coordinatorId: "coord-2" }),
    ).rejects.toThrow("Not your disbursement.");
  });

  it("blocks a deleted disbursement", async () => {
    const deps = stubDeps(makeDisbursement({ deletedAt: new Date(1) }));
    await expect(makeUseCase(deps).execute(INPUT)).rejects.toThrow("Disbursement not found.");
  });
});
