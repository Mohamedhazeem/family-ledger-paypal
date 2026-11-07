import { createHash } from "node:crypto";
import type {
  DisbursementRepository,
  LedgerEventRepository,
  RecipientInvitationRepository,
} from "@/application/ports/db";
import { InvitationNotFoundError } from "./get-invitation-view";

export interface DeclineToShareResult {
  planStatus: "BENEFICIARY_DECLINED_TO_SHARE";
}

/**
 * DeclineToShare use case (Slice 3.5, spec §6 Step 5, §4.4-4.5):
 * the beneficiary declines to share an allocation plan. Sets
 * planStatus=BENEFICIARY_DECLINED_TO_SHARE and logs a LedgerEvent.
 * Payment status and eligibility are never touched — the support
 * payment does not depend on sharing a plan.
 */
export class DeclineToShare {
  private readonly invitations: RecipientInvitationRepository;
  private readonly disbursements: DisbursementRepository;
  private readonly ledger: LedgerEventRepository;

  constructor(
    invitations: RecipientInvitationRepository,
    disbursements: DisbursementRepository,
    ledger: LedgerEventRepository,
  ) {
    this.invitations = invitations;
    this.disbursements = disbursements;
    this.ledger = ledger;
  }

  async execute(token: string): Promise<DeclineToShareResult> {
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
    await this.disbursements.updatePlanStatus(disbursement.id, "BENEFICIARY_DECLINED_TO_SHARE");
    await this.ledger.create({
      disbursementId: disbursement.id,
      actorType: "BENEFICIARY",
      actorId: null,
      eventType: "PLAN_DECLINED",
      payloadJson: JSON.stringify({ invitationId: invitation.id }),
    });
    return { planStatus: "BENEFICIARY_DECLINED_TO_SHARE" };
  }
}
