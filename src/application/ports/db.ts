import type {
  PaymentMode,
  PaymentStatus,
  PlanStatus,
  PreferredLanguage,
  UserRole,
} from "@/domain/entities/disbursement";

/**
 * Repository ports (ADR-0016/ADR-0017). No Prisma/Next/PayPal imports here;
 * adapters in src/infrastructure/db implement these DTO-shaped interfaces.
 */
export interface OrganizationRecord {
  id: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface OrganizationInput {
  name: string;
}

export interface UserRecord {
  id: string;
  organizationId: string | null;
  name: string;
  email: string;
  passwordHash: string | null;
  role: UserRole;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserInput {
  organizationId: string | null;
  name: string;
  email: string;
  passwordHash: string | null;
  role: UserRole;
}

export interface BeneficiaryRecord {
  id: string;
  organizationId: string;
  displayName: string;
  invitationEmail: string;
  encryptedPayPalRecipient: string;
  preferredLanguage: PreferredLanguage;
  createdAt: Date;
  updatedAt: Date;
}

export interface BeneficiaryInput {
  organizationId: string;
  displayName: string;
  invitationEmail: string;
  encryptedPayPalRecipient: string;
  preferredLanguage: PreferredLanguage;
}

export interface DisbursementRecord {
  id: string;
  publicReference: string;
  organizationId: string;
  coordinatorId: string;
  beneficiaryId: string;
  amountMinor: bigint;
  currency: string;
  supportNote: string;
  shareSupportNoteWithBeneficiary: boolean;
  planStatus: PlanStatus;
  paymentStatus: PaymentStatus;
  paypalPayoutBatchId: string | null;
  paypalPayoutItemId: string | null;
  paypalBatchStatus: string | null;
  paypalItemStatus: string | null;
  paymentMode: PaymentMode;
  createdAt: Date;
  updatedAt: Date;
}

export interface DisbursementInput {
  publicReference: string;
  organizationId: string;
  coordinatorId: string;
  beneficiaryId: string;
  amountMinor: bigint;
  currency?: string;
  supportNote: string;
  shareSupportNoteWithBeneficiary?: boolean;
  planStatus?: PlanStatus;
  paymentStatus?: PaymentStatus;
  paypalPayoutBatchId?: string | null;
  paypalPayoutItemId?: string | null;
  paypalBatchStatus?: string | null;
  paypalItemStatus?: string | null;
  paymentMode?: PaymentMode;
}

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
  updatePlanStatus(_id: string, _status: PlanStatus): Promise<DisbursementRecord>;
  updatePaymentStatus(_id: string, _status: PaymentStatus): Promise<DisbursementRecord>;
  /**
   * Single-submission lock (spec §11): atomically flips the status to
   * SUBMITTING only from NOT_SENT/READY. Returns true when this
   * caller won the claim.
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
}

export type ActorType = "COORDINATOR" | "BENEFICIARY" | "SYSTEM";

export interface PlanVersionRecord {
  id: string;
  disbursementId: string;
  versionNumber: number;
  createdByType: ActorType;
  createdById: string | null;
  summary: string;
  explanation: string | null;
  status: string;
  totalAllocatedMinor: bigint;
  unallocatedMinor: bigint;
  requiresClarification: boolean;
  createdAt: Date;
}

export interface PlanVersionInput {
  disbursementId: string;
  versionNumber: number;
  createdByType: ActorType;
  createdById: string | null;
  summary: string;
  explanation?: string | null;
  status: string;
  totalAllocatedMinor: bigint;
  unallocatedMinor: bigint;
  requiresClarification: boolean;
}

export interface PlanItemRecord {
  id: string;
  planVersionId: string;
  category: string;
  description: string | null;
  amountMinor: bigint | null;
  sourceText: string | null;
  sortOrder: number;
}

export interface PlanItemInput {
  planVersionId: string;
  category: string;
  description?: string | null;
  amountMinor?: bigint | null;
  sourceText?: string | null;
  sortOrder: number;
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

export interface LedgerEventRecord {
  id: string;
  disbursementId: string;
  actorType: ActorType;
  actorId: string | null;
  eventType: string;
  payloadJson: string;
  createdAt: Date;
}

export interface LedgerEventInput {
  disbursementId: string;
  actorType: ActorType;
  actorId: string | null;
  eventType: string;
  payloadJson: string;
}

/** Append-only: create only (spec §9). */
export interface LedgerEventRepository {
  create(_input: LedgerEventInput): Promise<LedgerEventRecord>;
}

export type AttemptState =
  | "CREATED"
  | "SUBMITTING"
  | "ACKNOWLEDGED"
  | "UNKNOWN"
  | "FAILED"
  | "RESOLVED";

export interface PayoutAttemptRecord {
  id: string;
  disbursementId: string;
  senderBatchId: string;
  senderItemId: string;
  paypalPayoutBatchId: string | null;
  attemptState: AttemptState;
  requestPayloadRedacted: string;
  responsePayloadRedacted: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface PayoutAttemptInput {
  disbursementId: string;
  senderBatchId: string;
  senderItemId: string;
  paypalPayoutBatchId: string | null;
  attemptState: AttemptState;
  requestPayloadRedacted: string;
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

export interface RecipientInvitationRecord {
  id: string;
  disbursementId: string;
  tokenHash: string;
  expiresAt: Date;
  revokedAt: Date | null;
  createdAt: Date;
  lastViewedAt: Date | null;
}

export interface RecipientInvitationInput {
  disbursementId: string;
  tokenHash: string;
  expiresAt: Date;
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
