import type {
  PaymentMode,
  PaymentStatus,
  PlanStatus,
  PreferredLanguage,
  UserRole,
} from "@/domain/entities/disbursement";

/**
 * DTO-shaped records and inputs for the repository ports (ADR-0016/0017).
 * Kept separate from the port interfaces so no source file grows past
 * the 300-LOC policy (ADR-0013). No Prisma/Next/PayPal imports here.
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
  /** Soft delete marker (ADR-0018); null while the record is live. */
  deletedAt: Date | null;
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

export interface PlanClarificationRecord {
  id: string;
  disbursementId: string;
  question: string;
  createdByType: ActorType;
  createdById: string | null;
  respondedAt: Date | null;
  createdAt: Date;
}

export interface PlanClarificationInput {
  disbursementId: string;
  question: string;
  createdByType: ActorType;
  createdById: string | null;
}
