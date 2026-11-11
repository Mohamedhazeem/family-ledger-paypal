import type {
  DisbursementRepository,
  LedgerEventRepository,
  RecipientInvitationRepository,
} from "@/application/ports/db";
import type { Clock } from "@/application/ports/clock";

export class DisbursementNotFoundError extends Error {}
export class CoordinatorMismatchError extends Error {}
export class NotDeletableError extends Error {}

export interface DeleteDisbursementResult {
  id: string;
  publicReference: string;
  deletedAt: Date;
}

/**
 * DeleteDisbursement use case (ADR-0018): soft-deletes a draft that was
 * never sent. The row is kept (deletedAt stamp) so the append-only
 * LedgerEvent history (ADR-0009) and every audit record survive.
 *
 * Guard: `paymentStatus === NOT_SENT` only. A disbursement that reached
 * READY/SUBMITTING/FAILED or any PayPal outcome is never deletable.
 * Active invitations are revoked first so old links stop resolving.
 */
export class DeleteDisbursement {
  private readonly disbursements: DisbursementRepository;
  private readonly invitations: RecipientInvitationRepository;
  private readonly ledger: LedgerEventRepository;
  private readonly clock: Clock;

  constructor(
    disbursements: DisbursementRepository,
    invitations: RecipientInvitationRepository,
    ledger: LedgerEventRepository,
    clock: Clock = { now: () => Date.now(), date: () => new Date() },
  ) {
    this.disbursements = disbursements;
    this.invitations = invitations;
    this.ledger = ledger;
    this.clock = clock;
  }

  async execute(input: {
    coordinatorId: string;
    disbursementId: string;
  }): Promise<DeleteDisbursementResult> {
    const disbursement = await this.disbursements.findById(input.disbursementId);
    if (!disbursement || disbursement.deletedAt !== null) {
      throw new DisbursementNotFoundError("Disbursement not found.");
    }
    if (disbursement.coordinatorId !== input.coordinatorId) {
      throw new CoordinatorMismatchError("Not your disbursement.");
    }
    if (disbursement.paymentStatus !== "NOT_SENT") {
      throw new NotDeletableError(
        "Only disbursements that have never been sent can be deleted.",
      );
    }

    const now = new Date(this.clock.now());

    // Revoke active invitations so previously shared links stop working.
    const existing = await this.invitations.listByDisbursementId(disbursement.id);
    for (const invitation of existing) {
      if (invitation.revokedAt === null && invitation.expiresAt > now) {
        await this.invitations.revoke(invitation.id, now);
        await this.ledger.create({
          disbursementId: disbursement.id,
          actorType: "COORDINATOR",
          actorId: input.coordinatorId,
          eventType: "INVITATION_REVOKED",
          payloadJson: JSON.stringify({
            invitationId: invitation.id,
            reason: "DISBURSEMENT_DELETED",
          }),
        });
      }
    }

    await this.disbursements.softDelete(disbursement.id, now);
    await this.ledger.create({
      disbursementId: disbursement.id,
      actorType: "COORDINATOR",
      actorId: input.coordinatorId,
      eventType: "DISBURSEMENT_DELETED",
      payloadJson: JSON.stringify({
        publicReference: disbursement.publicReference,
        reason: "DRAFT_DELETED",
      }),
    });

    return { id: disbursement.id, publicReference: disbursement.publicReference, deletedAt: now };
  }
}
