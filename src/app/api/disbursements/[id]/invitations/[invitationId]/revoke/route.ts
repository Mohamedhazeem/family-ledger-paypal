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
import { withSecurityHeaders } from "@/lib/security/headers";
import { isSameOrigin } from "@/lib/security/csrf";

/**
 * POST /api/disbursements/[id]/invitations/[invitationId]/revoke
 * (Slice 3.11, spec §6 Step 4). Coordinator-only. Idempotent.
 */
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string; invitationId: string }> },
) {
  const session = await requireSession();
  if (!isSameOrigin(request)) {
    return withSecurityHeaders(NextResponse.json({ error: "Cross-origin request rejected." }, { status: 403 }));
  }
  if (!session) {
    return withSecurityHeaders(NextResponse.json({ error: "Unauthorized" }, { status: 401 }));
  }
  const { id, invitationId } = await context.params;
  try {
    const result = await new RevokeInvitation(
      new PrismaRecipientInvitationRepository(),
      new PrismaDisbursementRepository(),
      new PrismaLedgerEventRepository(),
    ).execute({ coordinatorId: session.user.id, disbursementId: id, invitationId });
    return withSecurityHeaders(NextResponse.json({ invitationId: result.invitationId, revokedAt: result.revokedAt.toISOString() }));
  } catch (error) {
    if (error instanceof DisbursementNotFoundError) {
      return withSecurityHeaders(NextResponse.json({ error: error.message }, { status: 404 }));
    }
    if (error instanceof CoordinatorMismatchError) {
      return withSecurityHeaders(NextResponse.json({ error: error.message }, { status: 403 }));
    }
    return withSecurityHeaders(NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not revoke the invitation" },
      { status: 500 },
    ));
  }
}
