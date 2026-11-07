import { randomBytes } from "node:crypto";
import type {
  DisbursementRepository,
  PayoutAttemptRecord,
  PayoutAttemptRepository,
} from "@/application/ports/db";

export class DisbursementNotFoundError extends Error {}
export class CoordinatorMismatchError extends Error {}

export interface BeginPayoutInput {
  coordinatorId: string;
  disbursementId: string;
}

/**
 * SubmitPayout.begin (Slice 4.2, spec §9/§11): commits the payout
 * attempt row (unique senderBatchId) and the SUBMITTING payment
 * status BEFORE any HTTP call to PayPal. If the process crashes
 * afterwards the outcome stays SUBMITTING — never blank.
 * The outbound POST is wired in 4.3 through this same attempt.
 */
export class SubmitPayout {
  private readonly disbursements: DisbursementRepository;
  private readonly attempts: PayoutAttemptRepository;

  constructor(disbursements: DisbursementRepository, attempts: PayoutAttemptRepository) {
    this.disbursements = disbursements;
    this.attempts = attempts;
  }

  async begin(input: BeginPayoutInput): Promise<PayoutAttemptRecord> {
    const disbursement = await this.disbursements.findById(input.disbursementId);
    if (!disbursement) {
      throw new DisbursementNotFoundError("Disbursement not found.");
    }
    if (disbursement.coordinatorId !== input.coordinatorId) {
      throw new CoordinatorMismatchError("Not your disbursement.");
    }
    const senderBatchId = `FL-BATCH-${randomBytes(8).toString("hex").toUpperCase()}`;
    const attempt = await this.attempts.create({
      disbursementId: disbursement.id,
      senderBatchId,
      senderItemId: `${senderBatchId}-ITM`,
      paypalPayoutBatchId: null,
      attemptState: "SUBMITTING",
      // Redacted: shape only, never the recipient email or secrets.
      requestPayloadRedacted: JSON.stringify({
        sender_batch_id: senderBatchId,
        amountMinor: disbursement.amountMinor.toString(),
        currency: disbursement.currency,
      }),
    });
    await this.disbursements.updatePaymentStatus(disbursement.id, "SUBMITTING");
    return attempt;
  }
}
