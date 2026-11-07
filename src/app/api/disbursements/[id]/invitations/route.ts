import "server-only";
import { NextResponse } from "next/server";
import { env } from "@/env";
import {
  CoordinatorMismatchError,
  CreateInvitation,
  DisbursementNotFoundError,
} from "@/application/use-cases/create-invitation";
import {
  PrismaDisbursementRepository,
  PrismaLedgerEventRepository,
  PrismaRecipientInvitationRepository,
} from "@/infrastructure/db/repositories";
import { requireSession } from "@/lib/auth/session";

/**
 * POST /api/disbursements/[id]/invitations (Slice 3.1, spec §6 Step 4).
 * Coordinator-only (spec §13): creates a 32-byte random token, stores
 * only its SHA-256 hash, and returns the plaintext URL exactly once.
 * No email delivery in this slice.
 */
export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const session = await requireSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await context.params;
  try {
    const result = await new CreateInvitation(
      new PrismaDisbursementRepository(),
      new PrismaRecipientInvitationRepository(),
      new PrismaLedgerEventRepository(),
    ).execute({ coordinatorId: session.user.id, disbursementId: id });
    return NextResponse.json(
      {
        url: `${env.APP_URL.replace(/\/$/, "")}/beneficiary/${result.token}`,
        expiresAt: result.expiresAt.toISOString(),
      },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof DisbursementNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    if (error instanceof CoordinatorMismatchError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not create invitation" },
      { status: 500 },
    );
  }
}
