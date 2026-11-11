/**
 * @vitest-environment node
 */
import { describe, expect, it } from "vitest";
import { HandlePayPalWebhook } from "@/application/use-cases/handle-paypal-webhook";
import type { DisbursementRecord } from "@/application/ports/db";

type DisbursementState = Pick<
  DisbursementRecord,
  "id" | "paypalBatchStatus" | "paypalItemStatus" | "paymentStatus"
>;

function makeDisbursement(overrides: Partial<DisbursementState> = {}): DisbursementRecord {
  return {
    id: "disbursement-1",
    publicReference: "FL-TEST-001",
    organizationId: "org-1",
    coordinatorId: "coord-1",
    beneficiaryId: "beneficiary-1",
    amountMinor: 50000n,
    currency: "USD",
    supportNote: "support",
    shareSupportNoteWithBeneficiary: false,
    planStatus: "DRAFT",
    paymentStatus: "PENDING",
    paypalPayoutBatchId: "BATCH-1",
    paypalPayoutItemId: "BATCH-1-ITM",
    paypalBatchStatus: "PENDING",
    paypalItemStatus: "PENDING",
    paymentMode: "SANDBOX",
    deletedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe("HandlePayPalWebhook", () => {
  it("persists batch/item statuses separately and advances paymentStatus", async () => {
    const state = makeDisbursement();
    const events: unknown[] = [];
    const disbursements = {
      findByPayoutBatchId: async () => state,
      updatePayoutFields: async (_id: string, data: Partial<DisbursementState>) => {
        Object.assign(state, data);
        return state;
      },
      updatePaymentStatus: async (_id: string, status: DisbursementRecord["paymentStatus"]) => {
        state.paymentStatus = status;
        return state;
      },
      findById: async () => state,
    };
    const payouts = {
      getAccessToken: async () => "token",
      createBatch: async () => { throw new Error("unused"); },
      getBatchStatus: async () => ({
        batchStatus: "SUCCESS",
        itemStatus: "UNCLAIMED",
        paymentStatus: "SUCCESS" as const,
        raw: {},
      }),
    };
    const ledger = {
      create: async (input: unknown) => {
        events.push(input);
        return input;
      },
    };
    const result = await new HandlePayPalWebhook(
      disbursements as unknown as import("@/application/ports/db").DisbursementRepository,
      ledger as unknown as import("@/application/ports/db").LedgerEventRepository,
      payouts as unknown as import("@/application/ports/paypal").PayoutsPort,
    ).execute("BATCH-1");
    expect(result.paypalBatchStatus).toBe("SUCCESS");
    expect(result.paypalItemStatus).toBe("UNCLAIMED");
    expect(result.paymentStatus).toBe("SUCCESS");
    expect(result.changed).toBe(true);
    expect(events).toHaveLength(1);
  });

  it("is idempotent: a replay with unchanged statuses writes no ledger event", async () => {
    const state = makeDisbursement({
      paypalBatchStatus: "SUCCESS",
      paypalItemStatus: "UNCLAIMED",
    });
    const events: unknown[] = [];
    const disbursements = {
      findByPayoutBatchId: async () => state,
      updatePayoutFields: async (_id: string, data: Partial<DisbursementState>) => {
        Object.assign(state, data);
        return state;
      },
      updatePaymentStatus: async (_id: string, status: DisbursementRecord["paymentStatus"]) => {
        state.paymentStatus = status;
        return state;
      },
      findById: async () => state,
    };
    const payouts = {
      getAccessToken: async () => "token",
      createBatch: async () => { throw new Error("unused"); },
      getBatchStatus: async () => ({
        batchStatus: "SUCCESS",
        itemStatus: "UNCLAIMED",
        paymentStatus: "SUCCESS" as const,
        raw: {},
      }),
    };
    const ledger = {
      create: async (input: unknown) => {
        events.push(input);
        return input;
      },
    };
    const result = await new HandlePayPalWebhook(
      disbursements as unknown as import("@/application/ports/db").DisbursementRepository,
      ledger as unknown as import("@/application/ports/db").LedgerEventRepository,
      payouts as unknown as import("@/application/ports/paypal").PayoutsPort,
    ).execute("BATCH-1");
    expect(result.changed).toBe(false);
    expect(events).toHaveLength(0);
  });
});
