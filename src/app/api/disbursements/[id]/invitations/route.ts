import "server-only";
import { NextResponse } from "next/server";
import { env } from "@/env";
import {
  CoordinatorMismatchError,
  CreateInvitation,
  DisbursementNotFoundError,
} from "@/application/use-cases/create-invitation";
import {
  PrismaBeneficiaryRepository,
  PrismaDisbursementRepository,
  PrismaLedgerEventRepository,
  PrismaRecipientInvitationRepository,
} from "@/infrastructure/db/repositories";
import { createEmailAdapter } from "@/infrastructure/email/factory";
import { requireSession } from "@/lib/auth/session";
import { withSecurityHeaders } from "@/lib/security/headers";
import { isSameOrigin } from "@/lib/security/csrf";

/**
 * POST /api/disbursements/[id]/invitations (Slice 3.1, spec §6 Step 4).
 * Coordinator-only (spec §13): creates a 32-byte random token, stores
 * only its SHA-256 hash, and returns the plaintext URL exactly once.
 * No email delivery in this slice.
 */
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const session = await requireSession();
  if (!isSameOrigin(request)) {
    return withSecurityHeaders(NextResponse.json({ error: "Cross-origin request rejected." }, { status: 403 }));
  }
  if (!session) {
    return withSecurityHeaders(NextResponse.json({ error: "Unauthorized" }, { status: 401 }));
  }
  const { id } = await context.params;
  try {
    const disbursements = new PrismaDisbursementRepository();
    const result = await new CreateInvitation(
      disbursements,
      new PrismaRecipientInvitationRepository(),
      new PrismaLedgerEventRepository(),
    ).execute({ coordinatorId: session.user.id, disbursementId: id });

    const url = `${env.APP_URL.replace(/\/$/, "")}/beneficiary/${result.token}`;
    // Best-effort automatic delivery. With EMAIL_PROVIDER=noop (default)
    // this is a no-op; the coordinator still gets the copyable link.
    // Failures never block invitation creation.
    try {
      const disbursement = await disbursements.findById(id);
      if (disbursement) {
        const beneficiary = await new PrismaBeneficiaryRepository().findById(disbursement.beneficiaryId);
        if (beneficiary?.invitationEmail) {
          await createEmailAdapter().send({
            to: beneficiary.invitationEmail,
            subject: "You received a family support payment plan",
            text:
              `Hello ${beneficiary.displayName},\n\n` +
              `A support plan has been shared with you by ${"your programme"}.\n\n` +
              `Review it here (link valid until ${result.expiresAt.toLocaleDateString()}):\n${url}\n\n` +
              "This is a voluntary support plan. It does not restrict how you use the money you receive.",
          });
        }
      }
    } catch {
      // Email delivery is best-effort; the copyable link remains available.
    }

    return withSecurityHeaders(NextResponse.json(
      {
        url,
        expiresAt: result.expiresAt.toISOString(),
      },
      { status: 201 },
    ));
  } catch (error) {
    if (error instanceof DisbursementNotFoundError) {
      return withSecurityHeaders(NextResponse.json({ error: error.message }, { status: 404 }));
    }
    if (error instanceof CoordinatorMismatchError) {
      return withSecurityHeaders(NextResponse.json({ error: error.message }, { status: 403 }));
    }
    return withSecurityHeaders(NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not create invitation" },
      { status: 500 },
    ));
  }
}
