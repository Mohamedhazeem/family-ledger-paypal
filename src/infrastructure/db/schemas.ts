import { z } from "zod";

/** Zod validation at the adapter boundary (AGENTS §4/§8, ADR-0016). */
export const organizationInputSchema = z.object({
  name: z.string().trim().min(1, "Organization name is required."),
});

export const userInputSchema = z.object({
  organizationId: z.string().min(1).nullable().optional(),
  name: z.string().trim().min(1),
  email: z.string().trim().email(),
  passwordHash: z.string().min(1).nullable().optional(),
  role: z.enum(["ADMIN", "COORDINATOR"]),
});

export const beneficiaryInputSchema = z.object({
  organizationId: z.string().min(1),
  displayName: z.string().trim().min(1),
  invitationEmail: z.string().trim().email(),
  encryptedPayPalRecipient: z.string().min(1),
  preferredLanguage: z.enum(["en", "ta", "hi"]),
});

export const disbursementInputSchema = z.object({
  publicReference: z.string().trim().min(1),
  organizationId: z.string().min(1),
  coordinatorId: z.string().min(1),
  beneficiaryId: z.string().min(1),
  amountMinor: z.bigint().positive(),
  currency: z.literal("USD").default("USD"),
  supportNote: z.string().min(1),
  shareSupportNoteWithBeneficiary: z.boolean().default(false),
  planStatus: z
    .enum([
      "DRAFT",
      "INVITED",
      "BENEFICIARY_ACCEPTED",
      "REVISION_PROPOSED",
      "COORDINATOR_ACKNOWLEDGED",
      "BENEFICIARY_DECLINED_TO_SHARE",
      "NO_RESPONSE",
      "CLOSED",
    ])
    .default("DRAFT"),
  paymentStatus: z
    .enum([
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
    ])
    .default("NOT_SENT"),
  paypalPayoutBatchId: z.string().nullable().optional(),
  paypalPayoutItemId: z.string().nullable().optional(),
  paypalBatchStatus: z.string().nullable().optional(),
  paypalItemStatus: z.string().nullable().optional(),
  paymentMode: z.enum(["SANDBOX", "MOCK"]).default("SANDBOX"),
});

export type OrganizationInputParsed = z.infer<typeof organizationInputSchema>;
export type UserInputParsed = z.infer<typeof userInputSchema>;
export type BeneficiaryInputParsed = z.infer<typeof beneficiaryInputSchema>;
export type DisbursementInputParsed = z.infer<typeof disbursementInputSchema>;

export const planVersionInputSchema = z.object({
  disbursementId: z.string().min(1),
  versionNumber: z.number().int().positive(),
  createdByType: z.enum(["COORDINATOR", "BENEFICIARY", "SYSTEM"]),
  createdById: z.string().min(1).nullable(),
  summary: z.string(),
  explanation: z.string().nullable().optional(),
  status: z.string().min(1),
  totalAllocatedMinor: z.bigint().nonnegative(),
  unallocatedMinor: z.bigint().nonnegative(),
  requiresClarification: z.boolean(),
});

export const planItemInputSchema = z.object({
  planVersionId: z.string().min(1),
  category: z.string().trim().min(1),
  description: z.string().nullable().optional(),
  amountMinor: z.bigint().nonnegative().nullable().optional(),
  sourceText: z.string().nullable().optional(),
  sortOrder: z.number().int().nonnegative(),
});

export const ledgerEventInputSchema = z.object({
  disbursementId: z.string().min(1),
  actorType: z.enum(["COORDINATOR", "BENEFICIARY", "SYSTEM"]),
  actorId: z.string().min(1).nullable(),
  eventType: z.string().trim().min(1),
  payloadJson: z.string().min(1),
});

export const recipientInvitationInputSchema = z.object({
  disbursementId: z.string().min(1),
  tokenHash: z.string().min(1),
  expiresAt: z.date(),
});
