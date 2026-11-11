import type { PaymentStatus, PlanStatus } from "@/domain/entities/disbursement";
import type {
  AttemptState,
  BeneficiaryInput,
  BeneficiaryRecord,
  DisbursementInput,
  DisbursementRecord,
  LedgerEventInput,
  LedgerEventRecord,
  OrganizationInput,
  OrganizationRecord,
  PayoutAttemptInput,
  PayoutAttemptRecord,
  PlanItemInput,
  PlanItemRecord,
  PlanVersionInput,
  PlanVersionRecord,
  PlanClarificationInput,
  PlanClarificationRecord,
  RecipientInvitationInput,
  RecipientInvitationRecord,
  UserInput,
  UserRecord,
} from "./db-records";

export type {
  ActorType,
  AttemptState,
  BeneficiaryInput,
  BeneficiaryRecord,
  DisbursementInput,
  DisbursementRecord,
  LedgerEventInput,
  LedgerEventRecord,
  OrganizationInput,
  OrganizationRecord,
  PayoutAttemptInput,
  PayoutAttemptRecord,
  PlanClarificationInput,
  PlanClarificationRecord,
  PlanItemInput,
  PlanItemRecord,
  PlanVersionInput,
  PlanVersionRecord,
  RecipientInvitationInput,
  RecipientInvitationRecord,
  UserInput,
  UserRecord,
} from "./db-records";

/**
 * Repository ports (ADR-0016/ADR-0017). No Prisma/Next/PayPal imports here;
 * adapters in src/infrastructure/db implement these DTO-shaped interfaces.
 */

export interface OrganizationRepository {
  create(_input: OrganizationInput): Promise<OrganizationRecord>;
  findById(_id: string): Promise<OrganizationRecord | null>;
}

export interface UserRepository {
  create(_input: UserInput): Promise<UserRecord>;
  findById(_id: string): Promise<UserRecord | null>;
}

export interface BeneficiaryRepository {
  create(_input: BeneficiaryInput): Promise<BeneficiaryRecord>;
  findById(_id: string): Promise<BeneficiaryRecord | null>;
}

export interface DisbursementRepository {
  create(_input: DisbursementInput): Promise<DisbursementRecord>;
  findById(_id: string): Promise<DisbursementRecord | null>;
  findByPublicReference(_publicReference: string): Promise<DisbursementRecord | null>;
  /** Lookup by the PayPal payout batch id (webhook resolution). */
  findByPayoutBatchId(_payoutBatchId: string): Promise<DisbursementRecord | null>;
  updatePlanStatus(_id: string, _status: PlanStatus): Promise<DisbursementRecord>;
  updatePaymentStatus(_id: string, _status: PaymentStatus): Promise<DisbursementRecord>;
  /**
   * Update the full payout amount (ADR-0019). Only callable while the
   * disbursement has never been sent — enforced by the use case.
   */
  updateAmount(_id: string, _amountMinor: bigint): Promise<DisbursementRecord>;
  /**
   * Single-submission lock (spec §11): atomically flips the status to
   * SUBMITTING only from NOT_SENT/READY — or from FAILED, a terminal
   * outcome whose DEFINITELY-rejected batch never existed at PayPal
   * (a fresh attempt mints a new sender batch id). Returns true when
   * this caller won the claim.
   */
  claimForSubmission(_id: string): Promise<boolean>;
  updatePayoutFields(
    _id: string,
    _data: Partial<{
      paypalPayoutBatchId: string | null;
      paypalBatchStatus: string | null;
      paypalItemStatus: string | null;
    }>,
  ): Promise<DisbursementRecord>;
  /**
   * Soft delete (ADR-0018): stamps `deletedAt` instead of removing the
   * row, so the append-only LedgerEvent history survives. Only drafts
   * that were never sent may reach this method (enforced by the use case).
   */
  softDelete(_id: string, _deletedAt: Date): Promise<DisbursementRecord>;
}

/**
 * Immutable by construction: create only, no update/delete operation
 * exists in this port (spec §9: PlanVersions are immutable).
 */
export interface PlanVersionRepository {
  create(_input: PlanVersionInput): Promise<PlanVersionRecord>;
  createItems(_inputs: PlanItemInput[]): Promise<PlanItemRecord[]>;
  findLatestByDisbursementId(_disbursementId: string): Promise<PlanVersionRecord | null>;
  findItemsByVersionId(_planVersionId: string): Promise<PlanItemRecord[]>;
}

/** Append-only: create only (spec §9). */
export interface LedgerEventRepository {
  create(_input: LedgerEventInput): Promise<LedgerEventRecord>;
}

/**
 * One row per payout submission attempt (spec §9, §11).
 * senderBatchId/senderItemId carry unique constraints in the DB so
 * duplicate submissions cannot slip through.
 */
export interface PayoutAttemptRepository {
  create(_input: PayoutAttemptInput): Promise<PayoutAttemptRecord>;
  findBySenderBatchId(_senderBatchId: string): Promise<PayoutAttemptRecord | null>;
  findLatestByDisbursementId(_disbursementId: string): Promise<PayoutAttemptRecord | null>;
  update(
    _id: string,
    _data: Partial<{
      paypalPayoutBatchId: string | null;
      attemptState: AttemptState;
      responsePayloadRedacted: string | null;
    }>,
  ): Promise<PayoutAttemptRecord>;
}

/** Invitation repository: creation plus token lookup and view tracking. */
export interface RecipientInvitationRepository {
  create(_input: RecipientInvitationInput): Promise<RecipientInvitationRecord>;
  findById(_id: string): Promise<RecipientInvitationRecord | null>;
  findByTokenHash(_tokenHash: string): Promise<RecipientInvitationRecord | null>;
  listByDisbursementId(_disbursementId: string): Promise<RecipientInvitationRecord[]>;
  revoke(_id: string, _revokedAt: Date): Promise<RecipientInvitationRecord>;
  markViewed(_id: string, _viewedAt: Date): Promise<void>;
}

/** Clarification questions (ADR-0019 / spec §6 Step 7). */
export interface PlanClarificationRepository {
  create(_input: PlanClarificationInput): Promise<PlanClarificationRecord>;
  findLatestUnansweredByDisbursementId(_disbursementId: string): Promise<PlanClarificationRecord | null>;
  listByDisbursementId(_disbursementId: string): Promise<PlanClarificationRecord[]>;
  markResponded(_id: string, _respondedAt: Date): Promise<PlanClarificationRecord>;
}
