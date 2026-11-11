/**
 * ProposeCoordinatorRevision (ADR-0019): the coordinator adjusts the
 * total and/or categories after a beneficiary suggestion. Repositories
 * are stubbed; the use case must append a new version, never mutate the
 * beneficiary's, and lock the plan once a payout exists.
 */
import { describe, expect, it } from "vitest";
import { ProposeCoordinatorRevision } from "./propose-coordinator-revision";
import type {
  DisbursementRecord,
  LedgerEventInput,
  PlanVersionRecord,
} from "@/application/ports/db";

function makeDisbursement(overrides: Partial<DisbursementRecord> = {}): DisbursementRecord {
  return {
    id: "d-1",
    publicReference: "FL-ADJ-001",
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

const V1: PlanVersionRecord = {
  id: "pv-1",
  disbursementId: "d-1",
  versionNumber: 1,
  createdByType: "BENEFICIARY",
  createdById: null,
  summary: "v1",
  explanation: "we need more money for transport",
  status: "REVISION_PROPOSED",
  totalAllocatedMinor: 50000n,
  unallocatedMinor: 0n,
  requiresClarification: false,
  createdAt: new Date(0),
};

function stubDeps(disbursement: DisbursementRecord, latest: PlanVersionRecord | null) {
  const updatedAmount: bigint[] = [];
  const planStatuses: string[] = [];
  const createdVersions: PlanVersionRecord[] = [];
  const events: LedgerEventInput[] = [];
  const disbursements = {
    findById: async () => disbursement,
    updateAmount: async (_id: string, amountMinor: bigint) => {
      updatedAmount.push(amountMinor);
      return { ...disbursement, amountMinor };
    },
    updatePlanStatus: async (_id: string, status: string) => {
      planStatuses.push(status);
      return disbursement;
    },
  };
  const plans = {
    findLatestByDisbursementId: async () => latest,
    create: async (input: Omit<PlanVersionRecord, "id" | "createdAt">) => {
      const version = { id: `pv-${createdVersions.length + 1}`, createdAt: new Date(0), ...input };
      createdVersions.push(version);
      return version;
    },
    createItems: async () => [],
    findItemsByVersionId: async () => [],
  };
  const ledger = {
    create: async (input: LedgerEventInput) => {
      events.push(input);
      return { id: `evt-${events.length}`, createdAt: new Date(0), ...input };
    },
  };
  return { disbursements, plans, ledger, updatedAmount, planStatuses, createdVersions, events };
}

function makeUseCase(deps: ReturnType<typeof stubDeps>) {
  return new ProposeCoordinatorRevision(
    deps.disbursements as never,
    deps.plans as never,
    deps.ledger as never,
  );
}

const INPUT = {
  coordinatorId: "coord-1",
  disbursementId: "d-1",
  totalText: "600.00",
  items: [
    { category: "Rent", amountText: "300.00" },
    { category: "Transport", amountText: "100.00" },
  ],
};

describe("ProposeCoordinatorRevision (ADR-0019)", () => {
  it("updates the amount and appends a coordinator version, keeping v1", async () => {
    const deps = stubDeps(makeDisbursement(), V1);
    const result = await makeUseCase(deps).execute(INPUT);

    expect(result.versionNumber).toBe(2);
    expect(result.amountChanged).toBe(true);
    expect(result.totalMinor).toBe("60000");
    expect(deps.updatedAmount).toEqual([60000n]);
    expect(deps.planStatuses).toEqual(["REVISION_PROPOSED"]);
    expect(deps.createdVersions).toHaveLength(1);
    expect(deps.createdVersions[0]!.createdByType).toBe("COORDINATOR");
    expect(deps.createdVersions[0]!.totalAllocatedMinor).toBe(40000n);
    expect(deps.createdVersions[0]!.unallocatedMinor).toBe(20000n);

    const eventTypes = deps.events.map((e) => e.eventType);
    expect(eventTypes).toContain("DISBURSEMENT_AMOUNT_UPDATED");
    expect(eventTypes).toContain("PLAN_COORDINATOR_REVISION");
    const amountEvent = deps.events.find((e) => e.eventType === "DISBURSEMENT_AMOUNT_UPDATED");
    expect(amountEvent!.payloadJson).toContain("50000");
    expect(amountEvent!.payloadJson).not.toContain("note");
  });

  it("keeps the current total when totalText is omitted", async () => {
    const deps = stubDeps(makeDisbursement(), V1);
    const result = await makeUseCase(deps).execute({
      coordinatorId: "coord-1",
      disbursementId: "d-1",
      items: [{ category: "Rent", amountText: "300.00" }],
    });

    expect(result.amountChanged).toBe(false);
    expect(deps.updatedAmount).toHaveLength(0);
    expect(deps.events.map((e) => e.eventType)).not.toContain("DISBURSEMENT_AMOUNT_UPDATED");
  });

  it("blocks a disbursement that has been sent", async () => {
    const deps = stubDeps(makeDisbursement({ paymentStatus: "SUCCESS" }), V1);
    await expect(makeUseCase(deps).execute(INPUT)).rejects.toThrow(/locked/i);
    expect(deps.createdVersions).toHaveLength(0);
  });

  it("blocks a coordinator who does not own the disbursement", async () => {
    const deps = stubDeps(makeDisbursement(), V1);
    await expect(
      makeUseCase(deps).execute({ ...INPUT, coordinatorId: "coord-2" }),
    ).rejects.toThrow("Not your disbursement.");
  });

  it("blocks a deleted disbursement", async () => {
    const deps = stubDeps(makeDisbursement({ deletedAt: new Date(1) }), V1);
    await expect(makeUseCase(deps).execute(INPUT)).rejects.toThrow("Disbursement not found.");
  });

  it("rejects allocations over the new total before any write", async () => {
    const deps = stubDeps(makeDisbursement(), V1);
    await expect(
      makeUseCase(deps).execute({
        ...INPUT,
        totalText: "300.00",
        items: [{ category: "Rent", amountText: "400.00" }],
      }),
    ).rejects.toThrow(/exceed/i);
    expect(deps.createdVersions).toHaveLength(0);
    expect(deps.updatedAmount).toHaveLength(0);
  });

  it("rejects a zero total", async () => {
    const deps = stubDeps(makeDisbursement(), V1);
    await expect(makeUseCase(deps).execute({ ...INPUT, totalText: "0.00" })).rejects.toThrow(
      /greater than zero/i,
    );
  });
});
