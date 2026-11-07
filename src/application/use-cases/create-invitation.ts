import { createHash, randomBytes } from "node:crypto";
import type {
  DisbursementRepository,
  LedgerEventRepository,
  RecipientInvitationRepository,
} from "@/application/ports/db";

export const INVITATION_TOKEN_BYTES = 32;
export const INVITATION_EXPIRY_DAYS = 7;

export class DisbursementNotFoundError extends Error {}
export class CoordinatorMismatchError extends Error {}

export interface CreateInvitationInput {
  coordinatorId: string;
  disbursementId: string;
}

export interface CreatedInvitation {
  invitationId: string;
  token: string;
  expiresAt: Date;
}

/**
 * CreateInvitation use case (Slice 3.1, spec §6 Step 4, ADR-0007):
 * generates a 32-byte random token, stores only its SHA-256 hash,
 * with 7-day expiry, and logs a LedgerEvent. The plaintext token is
 * returned once so the caller can build the copyable URL.
 */
export class CreateInvitation {
  private readonly disbursements: DisbursementRepository;
  private readonly invitations: RecipientInvitationRepository;
  private readonly ledger: LedgerEventRepository;

  constructor(
    disbursements: DisbursementRepository,
    invitations: RecipientInvitationRepository,
    ledger: LedgerEventRepository,
  ) {
    this.disbursements = disbursements;
    this.invitations = invitations;
    this.ledger = ledger;
  }

  async execute(input: CreateInvitationInput): Promise<CreatedInvitation> {
    const disbursement = await this.disbursements.findById(input.disbursementId);
    if (!disbursement) {
      throw new DisbursementNotFoundError("Disbursement not found.");
    }
    if (disbursement.coordinatorId !== input.coordinatorId) {
      throw new CoordinatorMismatchError("Not your disbursement.");
    }
    const token = randomBytes(INVITATION_TOKEN_BYTES).toString("base64url");
    const tokenHash = createHash("sha256").update(token).digest("hex");
    const expiresAt = new Date(Date.now() + INVITATION_EXPIRY_DAYS * 24 * 60 * 60 * 1000);
    const invitation = await this.invitations.create({
      disbursementId: input.disbursementId,
      tokenHash,
      expiresAt,
    });
    await this.ledger.create({
      disbursementId: input.disbursementId,
      actorType: "COORDINATOR",
      actorId: input.coordinatorId,
      eventType: "INVITATION_CREATED",
      payloadJson: JSON.stringify({
        invitationId: invitation.id,
        expiresAt: expiresAt.toISOString(),
      }),
    });
    return { invitationId: invitation.id, token, expiresAt };
  }
}
