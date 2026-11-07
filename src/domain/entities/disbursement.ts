import { SUPPORTED_CURRENCY } from "@/domain/value-objects/money";

/**
 * Disbursement entity + independent state machines (ADR-0004, ADR-0017).
 * Pure TypeScript: no Next.js/Prisma/PayPal imports.
 * planStatus and paymentStatus are deliberately decoupled — beneficiary
 * consent (plan) never gates payment.
 */
export const PLAN_STATUSES = [
  "DRAFT",
  "INVITED",
  "BENEFICIARY_ACCEPTED",
  "REVISION_PROPOSED",
  "COORDINATOR_ACKNOWLEDGED",
  "BENEFICIARY_DECLINED_TO_SHARE",
  "NO_RESPONSE",
  "CLOSED",
] as const;
export type PlanStatus = (typeof PLAN_STATUSES)[number];

export const PAYMENT_STATUSES = [
  "NOT_SENT",
  "READY",
  "SUBMITTING",
  "STATUS_UNKNOWN",
  "PENDING",
  "PROCESSING",
  "SUCCESS",
  "DENIED",
  "FAILED",
  "UNCLAIMED",
  "RETURNED",
  "ON_HOLD",
  "BLOCKED",
  "REFUNDED",
  "REVERSED",
] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const PAYMENT_MODES = ["SANDBOX", "MOCK"] as const;
export type PaymentMode = (typeof PAYMENT_MODES)[number];

export const USER_ROLES = ["ADMIN", "COORDINATOR"] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const PREFERRED_LANGUAGES = ["en", "ta", "hi"] as const;
export type PreferredLanguage = (typeof PREFERRED_LANGUAGES)[number];

export interface Disbursement {
  id: string;
  publicReference: string;
  organizationId: string;
  coordinatorId: string;
  beneficiaryId: string;
  /** Integer minor units as BigInt — USD 500.00 == 50000n (ADR-0003). */
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

export interface CreateDisbursementInput {
  publicReference: string;
  organizationId: string;
  coordinatorId: string;
  beneficiaryId: string;
  amountMinor: bigint;
  currency?: string;
  supportNote: string;
  shareSupportNoteWithBeneficiary?: boolean;
  paymentMode?: PaymentMode;
}

/** Factory enforcing Slice 1.3 invariants for a newly created disbursement. */
export function createDisbursement(input: CreateDisbursementInput, now: Date = new Date()): Disbursement {
  const currency = input.currency ?? SUPPORTED_CURRENCY;
  if (currency !== SUPPORTED_CURRENCY) {
    throw new Error(`Unsupported currency: ${currency}. MVP is USD only.`);
  }
  if (input.amountMinor <= 0n) {
    throw new Error("Disbursement amountMinor must be greater than zero.");
  }
  if (!input.publicReference.trim()) {
    throw new Error("publicReference is required.");
  }
  return {
    id: "",
    publicReference: input.publicReference,
    organizationId: input.organizationId,
    coordinatorId: input.coordinatorId,
    beneficiaryId: input.beneficiaryId,
    amountMinor: input.amountMinor,
    currency,
    supportNote: input.supportNote,
    shareSupportNoteWithBeneficiary: input.shareSupportNoteWithBeneficiary ?? false,
    // Spec §6 / Step 1: a new record always starts DRAFT + NOT_SENT.
    planStatus: "DRAFT",
    paymentStatus: "NOT_SENT",
    paypalPayoutBatchId: null,
    paypalPayoutItemId: null,
    paypalBatchStatus: null,
    paypalItemStatus: null,
    paymentMode: input.paymentMode ?? "SANDBOX",
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Whether a payout may be submitted (spec §4.4-§4.5, ADR-0004).
 * Payment eligibility depends ONLY on payment state — beneficiary
 * consent (planStatus) never gates the support payment.
 */
export function canSubmitPayout(
  disbursement: Pick<Disbursement, "planStatus" | "paymentStatus">,
): boolean {
  return (
    disbursement.paymentStatus === "NOT_SENT" || disbursement.paymentStatus === "READY"
  );
}
