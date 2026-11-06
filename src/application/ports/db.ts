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
  organizationId: string;
  name: string;
  email: string;
  passwordHash: string;
  role: UserRole;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserInput {
  organizationId: string;
  name: string;
  email: string;
  passwordHash: string;
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
}
