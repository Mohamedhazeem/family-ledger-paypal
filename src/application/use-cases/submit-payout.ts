import { randomBytes } from "node:crypto";
import type { PaymentStatus } from "@/domain/entities/disbursement";
import type {
  BeneficiaryRepository,
  DisbursementRepository,
  LedgerEventRepository,
  PayoutAttemptRecord,
  PayoutAttemptRepository,
} from "@/application/ports/db";
import type { PayoutsPort } from "@/application/ports/paypal";
import { PayPalHttpError, PayPalNetworkError } from "@/application/ports/paypal";
import { canSubmitPayout } from "@/domain/entities/disbursement";
import { decryptField } from "@/lib/security/encryption";

export class DisbursementNotFoundError extends Error {}
export class CoordinatorMismatchError extends Error {}
export class PayoutNotSubmittableError extends Error {}

export interface SubmitPayoutInput {
  coordinatorId: string;
  disbursementId: string;
}

export interface SubmitPayoutResult {
  /** Winner of the claim (or the existing attempt for losers). */
  senderBatchId: string;
  attemptState: import("@/application/ports/db").AttemptState;
  paypalPayoutBatchId: string | null;
  paymentStatus: PaymentStatus;
}

/**
 * SubmitPayout use case (Slices 4.2-4.3, spec §9/§11, §4.4):
 * commits the attempt row and SUBMITTING status BEFORE any HTTP
 * call, then runs one full-amount payout and finalizes statuses.
 * Definitive 4xx → FAILED; 5xx/timeout → STATUS_UNKNOWN (retry in
 * 4.5 reuses the same sender batch id). Payout is never gated on
 * plan status (spec §4.4).
 */
export class SubmitPayout {
  private readonly disbursements: DisbursementRepository;
  private readonly attempts: PayoutAttemptRepository;
  private readonly beneficiaries: BeneficiaryRepository;
  private readonly ledger: LedgerEventRepository;
  private readonly payouts: PayoutsPort;

  constructor(
    disbursements: DisbursementRepository,
    attempts: PayoutAttemptRepository,
    beneficiaries: BeneficiaryRepository,
    ledger: LedgerEventRepository,
    payouts: PayoutsPort,
  ) {
    this.disbursements = disbursements;
    this.attempts = attempts;
    this.beneficiaries = beneficiaries;
    this.ledger = ledger;
    this.payouts = payouts;
  }

  /** Pre-flight: attempt row + SUBMITTING committed before any HTTP. */
  async begin(input: SubmitPayoutInput): Promise<PayoutAttemptRecord> {
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

  /** Full submission: claim, begin, POST one full-amount batch, finalize. */
  async execute(input: SubmitPayoutInput): Promise<SubmitPayoutResult> {
    const disbursement = await this.disbursements.findById(input.disbursementId);
    if (!disbursement) {
      throw new DisbursementNotFoundError("Disbursement not found.");
    }
    if (disbursement.coordinatorId !== input.coordinatorId) {
      throw new CoordinatorMismatchError("Not your disbursement.");
    }

    // Retry path (spec §11): a STATUS_UNKNOWN outcome means the
    // previous call may or may not have landed. Re-POST with the
    // SAME sender batch id — PayPal dedupes within 30 days — and
    // the single attempt row resolves. Never regenerate the id.
    if (disbursement.paymentStatus === "STATUS_UNKNOWN") {
      const existing = await this.attempts.findLatestByDisbursementId(disbursement.id);
      if (existing) {
        await this.disbursements.updatePaymentStatus(disbursement.id, "SUBMITTING");
        return this.runBatch(existing, disbursement, input);
      }
    }

    // Single-submission lock (spec §11): exactly one caller claims
    // the transition to SUBMITTING. Losers get the winner's batch id
    // without another outbound call. Eligible on payment state alone
    // (spec §4.4); plan status never gates.
    if (!canSubmitPayout(disbursement)) {
      throw new PayoutNotSubmittableError(
        `Payout cannot be submitted while payment status is ${disbursement.paymentStatus}.`,
      );
    }
    const won = await this.disbursements.claimForSubmission(disbursement.id);
    if (!won) {
      const existing = await this.waitForAttempt(disbursement.id);
      if (!existing) {
        throw new PayoutNotSubmittableError("A payout is already in flight for this disbursement.");
      }
      const current = await this.disbursements.findById(disbursement.id);
      return {
        senderBatchId: existing.senderBatchId,
        attemptState: existing.attemptState,
        paypalPayoutBatchId: existing.paypalPayoutBatchId,
        paymentStatus: current!.paymentStatus,
      };
    }

    const attempt = await this.begin(input);
    return this.runBatch(attempt, disbursement, input);
  }

  /** Re-POSTs one batch for an existing attempt and finalizes it. */
  private async runBatch(
    attempt: PayoutAttemptRecord,
    disbursement: { id: string; publicReference: string; beneficiaryId: string; amountMinor: bigint; currency: string },
    input: SubmitPayoutInput,
  ): Promise<SubmitPayoutResult> {
    const key = process.env.APP_ENCRYPTION_KEY;
    if (!key) {
      throw new Error("APP_ENCRYPTION_KEY is not set.");
    }
    const beneficiary = await this.beneficiaries.findById(disbursement.beneficiaryId);
    if (!beneficiary) {
      throw new Error("Beneficiary not found for disbursement.");
    }
    const receiverEmail = decryptField(beneficiary.encryptedPayPalRecipient, key);

    let result;
    try {
      result = await this.payouts.createBatch({
        senderBatchId: attempt.senderBatchId,
        senderItemId: attempt.senderItemId,
        publicReference: disbursement.publicReference,
        receiverEmail,
        amountMinor: disbursement.amountMinor,
        currency: disbursement.currency,
      });
    } catch (error) {
      const uncertain =
        error instanceof PayPalNetworkError ||
        (error instanceof PayPalHttpError && error.status >= 500);
      const attemptState = uncertain ? "UNKNOWN" : "FAILED";
      const paymentStatus: PaymentStatus = uncertain ? "STATUS_UNKNOWN" : "FAILED";
      await this.attempts.update(attempt.id, {
        attemptState,
        responsePayloadRedacted: error instanceof Error ? error.message : String(error),
      });
      await this.disbursements.updatePaymentStatus(disbursement.id, paymentStatus);
      return { senderBatchId: attempt.senderBatchId, attemptState: "UNKNOWN", paypalPayoutBatchId: null, paymentStatus };
    }

    await this.attempts.update(attempt.id, {
      paypalPayoutBatchId: result.payoutBatchId,
      attemptState: "ACKNOWLEDGED",
      responsePayloadRedacted: JSON.stringify(redactResponse(result.raw)),
    });
    await this.disbursements.updatePayoutFields(disbursement.id, {
      paypalPayoutBatchId: result.payoutBatchId,
      paypalBatchStatus: result.batchStatus,
    });
    await this.disbursements.updatePaymentStatus(disbursement.id, result.paymentStatus);
    await this.ledger.create({
      disbursementId: disbursement.id,
      actorType: "COORDINATOR",
      actorId: input.coordinatorId,
      eventType: "PAYMENT_SUBMITTED",
      payloadJson: JSON.stringify({
        senderBatchId: attempt.senderBatchId,
        payoutBatchId: result.payoutBatchId,
        batchStatus: result.batchStatus,
      }),
    });
    return {
      senderBatchId: attempt.senderBatchId,
      attemptState: "ACKNOWLEDGED",
      paypalPayoutBatchId: result.payoutBatchId,
      paymentStatus: result.paymentStatus,
    };
  }

  /** Losing callers see the winner's attempt once the row exists. */
  private async waitForAttempt(disbursementId: string) {
    for (let i = 0; i < 40; i++) {
      const attempt = await this.attempts.findLatestByDisbursementId(disbursementId);
      if (attempt) return attempt;
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    return null;
  }
}

/**
 * Keeps only the status/id shape of a PayPal response for storage —
 * never secrets, never recipient data beyond ids.
 */
export function redactResponse(raw: unknown): unknown {
  if (raw && typeof raw === "object") {
    const data = raw as Record<string, unknown>;
    const redacted: Record<string, unknown> = {};
    for (const key of ["payout_batch_id", "batch_status", "name", "message"]) {
      if (key in data) redacted[key] = data[key];
    }
    return redacted;
  }
  return String(raw);
}
