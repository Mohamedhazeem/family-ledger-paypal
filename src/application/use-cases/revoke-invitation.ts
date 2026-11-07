import type {
  DisbursementRepository,
  LedgerEventRepository,
  RecipientInvitationRepository,
} from "@/application/ports/db";

export class DisbursementNotFoundError extends Error {}
export class CoordinatorMismatchError extends Error {}

export interface RevokeInvitationInput {
  coordinatorId: string;
  disbursementId: string;
  invitationId: string;
}

export interface RevokedInvitation {
  invitationId: string;
  revokedAt: Date;
}

/**
 * RevokeInvitation use case (Slice 3.11, spec §6 Step 4, §9):
 * sets revokedAt and logs a LedgerEvent. Already-revoked invitations
 * return successfully without a duplicate event (idempotent). The
 * public portal refuses the token immediately afterwards.
 */
export class RevokeInvitation {
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

  async execute(input: RevokeInvitationInput): Promise<RevokedInvitation> {
    const invitation = await this.invitations.findById(input.invitationId);
    if (!invitation || invitation.disbursementId !== input.disbursementId) {
      throw new DisbursementNotFoundError("Invitation not found.");
    }
    const disbursement = await this.disbursements.findById(input.disbursementId);
    if (!disbursement) {
      throw new DisbursementNotFoundError("Invitation not found.");
    }
    if (disbursement.coordinatorId !== input.coordinatorId) {
      throw new CoordinatorMismatchError("Not your disbursement.");
    }
    if (invitation.revokedAt !== null) {
      return { invitationId: invitation.id, revokedAt: invitation.revokedAt };
    }
    const revokedAt = new Date();
    const revoked = await this.invitations.revoke(invitation.id, revokedAt);
    await this.ledger.create({
      disbursementId: disbursement.id,
      actorType: "COORDINATOR",
      actorId: input.coordinatorId,
      eventType: "INVITATION_REVOKED",
      payloadJson: JSON.stringify({ invitationId: invitation.id }),
    });
    return { invitationId: revoked.id, revokedAt: revoked.revokedAt! };
  }
}
