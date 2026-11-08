import "server-only";
import type {
  BatchStatusResult,
  CreateBatchInput,
  CreateBatchResult,
  PayoutsPort,
} from "@/application/ports/paypal";

/**
 * Mock PayPal adapter (ADR-0016, spec §10): deterministic, offline
 * stand-in for tests/dev. Never calls the network. Rows created
 * through this adapter must be badged MOCK in the UI; the judge demo
 * uses the real sandbox adapter.
 */
export class MockPayPalAdapter implements PayoutsPort {
  async getAccessToken(): Promise<string> {
    return "mock-token";
  }

  async createBatch(input: CreateBatchInput): Promise<CreateBatchResult> {
    const payoutBatchId = `MOCK-${input.senderBatchId}`;
    return {
      payoutBatchId,
      batchStatus: "PENDING",
      paymentStatus: "PENDING",
      raw: {
        payout_batch_id: payoutBatchId,
        batch_status: "PENDING",
        sender_batch_id: input.senderBatchId,
        mock: true,
      },
    };
  }

  async getBatchStatus(payoutBatchId: string): Promise<BatchStatusResult> {
    return {
      batchStatus: "PENDING",
      itemStatus: "PENDING",
      paymentStatus: "PENDING",
      raw: { payout_batch_id: payoutBatchId, batch_status: "PENDING", mock: true },
    };
  }
}
