import type {
  DisbursementRepository,
  LedgerEventRepository,
} from "@/application/ports/db";
import type { PayoutsPort } from "@/application/ports/paypal";

export class WebhookDisbursementNotFoundError extends Error {}

export interface HandleWebhookResult {
  disbursementId: string;
  paypalBatchStatus: string | null;
  paypalItemStatus: string | null;
  paymentStatus: string;
  /** True when the stored status changed (idempotent replays return false). */
  changed: boolean;
}

/**
 * HandlePayPalWebhook use case (spec §11 stretch): after signature
 * verification, refetch the batch resource from PayPal (batch webhook
 * events lack full item detail) and persist batch/item statuses
 * separately. Idempotent: a replay with unchanged statuses writes no
 * ledger event. Unknown statuses never regress paymentStatus.
 */
export class HandlePayPalWebhook {
  private readonly disbursements: DisbursementRepository;
  private readonly ledger: LedgerEventRepository;
  private readonly payouts: PayoutsPort;

  constructor(
    disbursements: DisbursementRepository,
    ledger: LedgerEventRepository,
    payouts: PayoutsPort,
  ) {
    this.disbursements = disbursements;
    this.ledger = ledger;
    this.payouts = payouts;
  }

  async execute(payoutBatchId: string): Promise<HandleWebhookResult> {
    const disbursement = await this.disbursements.findByPayoutBatchId(payoutBatchId);
    if (!disbursement) {
      throw new WebhookDisbursementNotFoundError("Unknown payout batch.");
    }
    const status = await this.payouts.getBatchStatus(payoutBatchId);
    const changed =
      disbursement.paypalBatchStatus !== status.batchStatus ||
      disbursement.paypalItemStatus !== status.itemStatus;
    await this.disbursements.updatePayoutFields(disbursement.id, {
      paypalBatchStatus: status.batchStatus,
      paypalItemStatus: status.itemStatus,
    });
    if (status.paymentStatus !== null && status.paymentStatus !== disbursement.paymentStatus) {
      await this.disbursements.updatePaymentStatus(disbursement.id, status.paymentStatus);
    }
    if (changed) {
      await this.ledger.create({
        disbursementId: disbursement.id,
        actorType: "SYSTEM",
        actorId: null,
        eventType: "PAYOUT_STATUS_WEBHOOK",
        payloadJson: JSON.stringify({
          payoutBatchId,
          batchStatus: status.batchStatus,
          itemStatus: status.itemStatus,
        }),
      });
    }
    const current = await this.disbursements.findById(disbursement.id);
    return {
      disbursementId: disbursement.id,
      paypalBatchStatus: status.batchStatus,
      paypalItemStatus: status.itemStatus,
      paymentStatus: current?.paymentStatus ?? disbursement.paymentStatus,
      changed,
    };
  }
}
