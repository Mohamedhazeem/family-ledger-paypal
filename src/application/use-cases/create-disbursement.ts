import { customAlphabet } from "nanoid";
import { toMinorUnits } from "@/domain/value-objects/money";
import type {
  BeneficiaryRepository,
  DisbursementRecord,
  LedgerEventRepository,
  PlanVersionRepository,
  UserRepository,
  DisbursementRepository,
} from "@/application/ports/db";
import { encryptField } from "@/lib/security/encryption";

const referenceAlphabet = customAlphabet("ABCDEFGHJKLMNPQRSTUVWXYZ23456789", 8);

export interface PlanDraftItem {
  category: string;
  /** Decimal string, or null when no explicit amount was stated. */
  amountText: string | null;
  evidenceText?: string | null;
}

export interface CreateDisbursementInput {
  coordinatorId: string;
  beneficiary: {
    displayName: string;
    invitationEmail: string;
    /** Plaintext from the coordinator; encrypted before storage. */
    payPalRecipientEmail: string;
    preferredLanguage: "en" | "ta" | "hi";
  };
  /** Decimal string, e.g. "500.00" (converted once at the boundary). */
  amountText: string;
  currency: string;
  supportNote: string;
  shareSupportNoteWithBeneficiary: boolean;
  /**
   * Optional coordinator-confirmed plan draft (Slice 2.7). When
   * present, immutable PlanVersion v1 + PlanItems + LedgerEvent are
   * persisted on save. Over-total plans are rejected before any write.
   */
  plan?: {
    summary?: string;
    items: PlanDraftItem[];
  };
}

/**
 * CreateDisbursement use case (Slice 2.6, spec §6 Step 1, extended by
 * 2.7): creates the Beneficiary and Disbursement rows at
 * planStatus DRAFT / paymentStatus NOT_SENT, and — when a plan draft
 * is supplied — the immutable PlanVersion v1 (with deterministic
 * sum-vs-total validation) plus a LedgerEvent. The PayPal recipient
 * is stored AES-256-GCM encrypted (ADR-0008).
 */
export class CreateDisbursement {
  private readonly users: UserRepository;
  private readonly beneficiaries: BeneficiaryRepository;
  private readonly disbursements: DisbursementRepository;
  private readonly plans: PlanVersionRepository;
  private readonly ledger: LedgerEventRepository;

  constructor(
    users: UserRepository,
    beneficiaries: BeneficiaryRepository,
    disbursements: DisbursementRepository,
    plans: PlanVersionRepository,
    ledger: LedgerEventRepository,
  ) {
    this.users = users;
    this.beneficiaries = beneficiaries;
    this.disbursements = disbursements;
    this.plans = plans;
    this.ledger = ledger;
  }

  async execute(input: CreateDisbursementInput): Promise<DisbursementRecord> {
    const coordinator = await this.users.findById(input.coordinatorId);
    if (!coordinator?.organizationId) {
      throw new Error("Coordinator has no organization.");
    }

    const totalMinor = toMinorUnits(input.amountText, input.currency);

    // Deterministic plan validation runs before any write (spec §6):
    // over-total is rejected; under-total keeps the remainder unallocated.
    let totalAllocated = 0n;
    if (input.plan) {
      for (const item of input.plan.items) {
        if (item.amountText !== null) {
          totalAllocated += toMinorUnits(item.amountText, input.currency);
        }
      }
      if (totalAllocated > totalMinor) {
        throw new Error(
          "Allocations exceed the disbursement total. Adjust the plan before saving.",
        );
      }
    }

    const key = process.env.APP_ENCRYPTION_KEY;
    if (!key) {
      throw new Error("APP_ENCRYPTION_KEY is not set.");
    }
    const beneficiary = await this.beneficiaries.create({
      organizationId: coordinator.organizationId,
      displayName: input.beneficiary.displayName,
      invitationEmail: input.beneficiary.invitationEmail,
      encryptedPayPalRecipient: encryptField(input.beneficiary.payPalRecipientEmail, key),
      preferredLanguage: input.beneficiary.preferredLanguage,
    });
    const disbursement = await this.disbursements.create({
      publicReference: `FL-${referenceAlphabet()}`,
      organizationId: coordinator.organizationId,
      coordinatorId: input.coordinatorId,
      beneficiaryId: beneficiary.id,
      amountMinor: totalMinor,
      currency: input.currency,
      supportNote: input.supportNote,
      shareSupportNoteWithBeneficiary: input.shareSupportNoteWithBeneficiary,
      planStatus: "DRAFT",
      paymentStatus: "NOT_SENT",
      paymentMode: "SANDBOX",
    });
    await this.ledger.create({
      disbursementId: disbursement.id,
      actorType: "COORDINATOR",
      actorId: input.coordinatorId,
      eventType: "DISBURSEMENT_CREATED",
      payloadJson: JSON.stringify({ publicReference: disbursement.publicReference }),
    });

    if (input.plan) {
      const unallocatedMinor = totalMinor - totalAllocated;
      const version = await this.plans.create({
        disbursementId: disbursement.id,
        versionNumber: 1,
        createdByType: "COORDINATOR",
        createdById: input.coordinatorId,
        summary: input.plan.summary ?? "",
        status: "DRAFT",
        totalAllocatedMinor: totalAllocated,
        unallocatedMinor,
        requiresClarification: false,
      });
      await this.plans.createItems(
        input.plan.items.map((item, index) => ({
          planVersionId: version.id,
          category: item.category,
          amountMinor:
            item.amountText === null ? null : toMinorUnits(item.amountText, input.currency),
          sourceText: item.evidenceText ?? null,
          sortOrder: index,
        })),
      );
      await this.ledger.create({
        disbursementId: disbursement.id,
        actorType: "COORDINATOR",
        actorId: input.coordinatorId,
        eventType: "PLAN_VERSION_CREATED",
        payloadJson: JSON.stringify({
          versionNumber: 1,
          totalAllocatedMinor: totalAllocated.toString(),
          unallocatedMinor: unallocatedMinor.toString(),
          itemCount: input.plan.items.length,
        }),
      });
    }

    return disbursement;
  }
}
