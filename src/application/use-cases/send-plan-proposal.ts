import type {
  BeneficiaryRepository,
  DisbursementRepository,
  LedgerEventRepository,
  OrganizationRepository,
  PlanVersionRepository,
} from "@/application/ports/db";
import type { EmailPort, PlanProposalEmailData } from "@/application/ports/email";
import { CreateInvitation, CoordinatorMismatchError, DisbursementNotFoundError } from "./create-invitation";

export class MissingPlanError extends Error {}
export class MissingEmailError extends Error {}

export interface SendPlanProposalInput {
  coordinatorId: string;
  disbursementId: string;
  /** Absolute base URL (e.g. https://app.example.com) supplied by the framework layer. */
  appUrl: string;
}

export interface PlanProposalSent {
  invitationId: string;
  url: string;
  expiresAt: Date;
  delivered: boolean;
  provider: string;
  /** Present when delivered is false and a provider supplied a reason. */
  error?: string;
  planVersionNumber: number;
}

/**
 * SendPlanProposal use case: mints a fresh invitation and delivers the
 * LATEST plan version (categories + canonical amounts + secure link) to
 * the beneficiary's invitation email (spec §6 Step 4, ADR-0016).
 *
 * Reuses CreateInvitation, so the one-live-link rule applies: sending
 * again supersedes (revokes) the previous active link. The plaintext
 * token is never stored (ADR-0007), so a URL cannot be reconstructed for
 * an existing invitation — a new link is the only server-side option.
 * Email delivery is best-effort; the copyable link is always returned.
 */
export class SendPlanProposal {
  private readonly disbursements: DisbursementRepository;
  private readonly beneficiaries: BeneficiaryRepository;
  private readonly organizations: OrganizationRepository;
  private readonly plans: PlanVersionRepository;
  private readonly ledger: LedgerEventRepository;
  private readonly email: EmailPort;
  private readonly createInvitation: CreateInvitation;

  constructor(
    disbursements: DisbursementRepository,
    beneficiaries: BeneficiaryRepository,
    organizations: OrganizationRepository,
    plans: PlanVersionRepository,
    ledger: LedgerEventRepository,
    email: EmailPort,
    createInvitation: CreateInvitation,
  ) {
    this.disbursements = disbursements;
    this.beneficiaries = beneficiaries;
    this.organizations = organizations;
    this.plans = plans;
    this.ledger = ledger;
    this.email = email;
    this.createInvitation = createInvitation;
  }

  async execute(input: SendPlanProposalInput): Promise<PlanProposalSent> {
    const disbursement = await this.disbursements.findById(input.disbursementId);
    if (!disbursement || disbursement.deletedAt !== null) {
      throw new DisbursementNotFoundError("Disbursement not found.");
    }
    if (disbursement.coordinatorId !== input.coordinatorId) {
      throw new CoordinatorMismatchError("Not your disbursement.");
    }

    const version = await this.plans.findLatestByDisbursementId(disbursement.id);
    if (!version) {
      throw new MissingPlanError("Create a plan before sending the proposal.");
    }
    const items = await this.plans.findItemsByVersionId(version.id);

    const beneficiary = await this.beneficiaries.findById(disbursement.beneficiaryId);
    if (!beneficiary || !beneficiary.invitationEmail) {
      throw new MissingEmailError("The beneficiary has no invitation email.");
    }
    const organization = await this.organizations.findById(disbursement.organizationId);

    const invitation = await this.createInvitation.execute({
      coordinatorId: input.coordinatorId,
      disbursementId: disbursement.id,
    });

    const url = `${input.appUrl.replace(/\/$/, "")}/beneficiary/${invitation.token}`;
    const proposal: PlanProposalEmailData = {
      to: beneficiary.invitationEmail,
      beneficiaryDisplayName: beneficiary.displayName,
      programmeName: organization?.name ?? "FamilyLedger",
      amountMinor: disbursement.amountMinor,
      currency: disbursement.currency,
      items: items.map((item) => ({ category: item.category, amountMinor: item.amountMinor })),
      unallocatedMinor: version.unallocatedMinor,
      url,
      expiresAt: invitation.expiresAt,
    };
    const delivery = await this.email.sendPlanProposal(proposal);

    await this.ledger.create({
      disbursementId: disbursement.id,
      actorType: "COORDINATOR",
      actorId: input.coordinatorId,
      eventType: "PLAN_PROPOSAL_SENT",
      payloadJson: JSON.stringify({
        invitationId: invitation.invitationId,
        planVersionNumber: version.versionNumber,
        delivered: delivery.delivered,
        provider: delivery.provider,
      }),
    });

    return {
      invitationId: invitation.invitationId,
      url,
      expiresAt: invitation.expiresAt,
      delivered: delivery.delivered,
      provider: delivery.provider,
      error: delivery.error,
      planVersionNumber: version.versionNumber,
    };
  }
}
