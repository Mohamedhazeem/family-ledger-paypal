import type {
  DisbursementRepository,
  PayoutAttemptRepository,
} from "@/application/ports/db";
import type { PayoutsPort } from "@/application/ports/paypal";

export class DisbursementNotFoundError extends Error {}
export class NoPayoutSubmittedError extends Error {}

export interface GetPayoutStatusInput {
  coordinatorId: string;
  disbursementId: string;
}

export interface GetPayoutStatusResult {
  paypalPayoutBatchId: string;
  /** Raw PayPal batch status, preserved verbatim. */
  paypalBatchStatus: string | null;
  /** Raw item transaction status, preserved verbatim. */
  paypalItemStatus: string | null;
  /** Payment state after a KNOWN status; unchanged on unknown. */
  paymentStatus: string;
  attemptState: string;
}

/**
 * GetPayoutStatus use case (Slice 4.6, spec Step 9): refreshes the
 * payout batch from PayPal and persists batch + item statuses
 * SEPARATELY. Unknown raw statuses are stored verbatim and never
 * regress paymentStatus (spec §10). There is no webhook/background
 * job in this slice — refresh is explicit.
 */
export class GetPayoutStatus {
  private readonly disbursements: DisbursementRepository;
  private readonly attempts: PayoutAttemptRepository;
  private readonly payouts: PayoutsPort;

  constructor(
    disbursements: DisbursementRepository,
    attempts: PayoutAttemptRepository,
    payouts: PayoutsPort,
  ) {
    this.disbursements = disbursements;
    this.attempts = attempts;
    this.payouts = payouts;
  }

  async execute(input: GetPayoutStatusInput): Promise<GetPayoutStatusResult> {
    const disbursement = await this.disbursements.findById(input.disbursementId);
    if (!disbursement) {
      throw new DisbursementNotFoundError("Disbursement not found.");
    }
    if (disbursement.coordinatorId !== input.coordinatorId) {
      throw new Error("Not your disbursement.");
    }
    const batchId = disbursement.paypalPayoutBatchId;
    if (!batchId) {
      throw new NoPayoutSubmittedError("No payout has been submitted yet.");
    }

    const status = await this.payouts.getBatchStatus(batchId);
    await this.disbursements.updatePayoutFields(disbursement.id, {
      paypalBatchStatus: status.batchStatus,
      paypalItemStatus: status.itemStatus,
    });
    if (status.paymentStatus !== null) {
      await this.disbursements.updatePaymentStatus(disbursement.id, status.paymentStatus);
    }
    const attempt = await this.attempts.findLatestByDisbursementId(disbursement.id);
    const current = await this.disbursements.findById(disbursement.id);
    return {
      paypalPayoutBatchId: batchId,
      paypalBatchStatus: status.batchStatus,
      paypalItemStatus: status.itemStatus,
      paymentStatus: status.paymentStatus ?? current!.paymentStatus,
      attemptState: attempt?.attemptState ?? "UNKNOWN",
    };
  }
}
