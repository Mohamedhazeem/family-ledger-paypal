import "server-only";
import { NextResponse } from "next/server";
import {
  CoordinatorMismatchError,
  DisbursementNotFoundError,
  RevokeInvitation,
} from "@/application/use-cases/revoke-invitation";
import {
  PrismaDisbursementRepository,
  PrismaLedgerEventRepository,
  PrismaRecipientInvitationRepository,
} from "@/infrastructure/db/repositories";
import { requireSession } from "@/lib/auth/session";

/**
 * POST /api/disbursements/[id]/invitations/[invitationId]/revoke
 * (Slice 3.11, spec §6 Step 4). Coordinator-only. Idempotent.
 */
export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string; invitationId: string }> },
) {
  const session = await requireSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id, invitationId } = await context.params;
  try {
    const result = await new RevokeInvitation(
      new PrismaRecipientInvitationRepository(),
      new PrismaDisbursementRepository(),
      new PrismaLedgerEventRepository(),
    ).execute({ coordinatorId: session.user.id, disbursementId: id, invitationId });
    return NextResponse.json({ invitationId: result.invitationId, revokedAt: result.revokedAt.toISOString() });
  } catch (error) {
    if (error instanceof DisbursementNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    if (error instanceof CoordinatorMismatchError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not revoke the invitation" },
      { status: 500 },
    );
  }
}
