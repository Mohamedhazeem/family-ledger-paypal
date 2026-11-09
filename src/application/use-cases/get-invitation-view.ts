import { createHash } from "node:crypto";
import type {
  BeneficiaryRepository,
  DisbursementRepository,
  LedgerEventRepository,
  OrganizationRepository,
  PlanVersionRepository,
  RecipientInvitationRepository,
} from "@/application/ports/db";

export class InvitationNotFoundError extends Error {}

export interface InvitationViewItem {
  category: string;
  amountMinor: bigint | null;
}

export interface InvitationView {
  disbursementId: string;
  programmeName: string;
  beneficiaryDisplayName: string;
  beneficiaryLanguage: "en" | "ta" | "hi";
  amountMinor: bigint;
  currency: string;
  items: InvitationViewItem[];
  /** Present only when the coordinator marked the note shareable. */
  supportNote: string | null;
}

/**
 * GetInvitationView use case (Slice 3.2, spec §14F, §13, ADR-0007):
 * resolves a public token to the shareable portal view. Unknown,
 * expired, and revoked tokens are indistinguishable. Only data the
 * beneficiary is allowed to see is returned — coordinator notes are
 * included only when marked shareable; the PayPal recipient email
 * is never returned.
 */
export class GetInvitationView {
  private readonly invitations: RecipientInvitationRepository;
  private readonly disbursements: DisbursementRepository;
  private readonly beneficiaries: BeneficiaryRepository;
  private readonly plans: PlanVersionRepository;
  private readonly organizations: OrganizationRepository;
  private readonly ledger: LedgerEventRepository;

  constructor(
    invitations: RecipientInvitationRepository,
    disbursements: DisbursementRepository,
    beneficiaries: BeneficiaryRepository,
    plans: PlanVersionRepository,
    organizations: OrganizationRepository,
    ledger: LedgerEventRepository,
  ) {
    this.invitations = invitations;
    this.disbursements = disbursements;
    this.beneficiaries = beneficiaries;
    this.plans = plans;
    this.organizations = organizations;
    this.ledger = ledger;
  }

  async execute(token: string): Promise<InvitationView> {
    const tokenHash = createHash("sha256").update(token).digest("hex");
    const invitation = await this.invitations.findByTokenHash(tokenHash);
    if (
      !invitation ||
      invitation.revokedAt !== null ||
      invitation.expiresAt.getTime() <= Date.now()
    ) {
      throw new InvitationNotFoundError("This invitation link is not valid.");
    }
    const disbursement = await this.disbursements.findById(invitation.disbursementId);
    if (!disbursement) {
      throw new InvitationNotFoundError("This invitation link is not valid.");
    }
    const organization = await this.organizations.findById(disbursement.organizationId);
    const beneficiary = await this.beneficiaries.findById(disbursement.beneficiaryId);
    const version = await this.plans.findLatestByDisbursementId(disbursement.id);
    const items = version ? await this.plans.findItemsByVersionId(version.id) : [];

    // Track the latest view, but only write the append-only "viewed"
    // event on the first view — repeat opens must not flood the
    // shared timeline.
    await this.invitations.markViewed(invitation.id, new Date());
    if (invitation.lastViewedAt === null) {
      await this.ledger.create({
        disbursementId: disbursement.id,
        actorType: "BENEFICIARY",
        actorId: null,
        eventType: "INVITATION_VIEWED",
        payloadJson: JSON.stringify({ invitationId: invitation.id }),
      });
    }

    return {
      disbursementId: disbursement.id,
      programmeName: organization?.name ?? "FamilyLedger",
      beneficiaryDisplayName: beneficiary?.displayName ?? "",
      beneficiaryLanguage: beneficiary?.preferredLanguage ?? "en",
      amountMinor: disbursement.amountMinor,
      currency: disbursement.currency,
      items: items.map((item) => ({ category: item.category, amountMinor: item.amountMinor })),
      supportNote: disbursement.shareSupportNoteWithBeneficiary ? disbursement.supportNote : null,
    };
  }
}
