import "server-only";
import { NextResponse } from "next/server";
import { env } from "@/env";
import {
  CoordinatorMismatchError,
  CreateInvitation,
  DisbursementNotFoundError,
} from "@/application/use-cases/create-invitation";
import {
  MissingEmailError,
  MissingPlanError,
  SendPlanProposal,
} from "@/application/use-cases/send-plan-proposal";
import {
  PrismaBeneficiaryRepository,
  PrismaDisbursementRepository,
  PrismaLedgerEventRepository,
  PrismaOrganizationRepository,
  PrismaPlanVersionRepository,
  PrismaRecipientInvitationRepository,
} from "@/infrastructure/db/repositories";
import { createEmailAdapter } from "@/infrastructure/email/factory";
import { requireSession } from "@/lib/auth/session";
import { withSecurityHeaders } from "@/lib/security/headers";
import { isSameOrigin } from "@/lib/security/csrf";
import { logger } from "@/lib/log";

/**
 * POST /api/disbursements/[id]/send-plan
 * Coordinator-only. Mints a fresh invitation and emails the LATEST plan
 * version (categories + amounts + secure link) to the beneficiary.
 * Returns the delivery outcome so the UI can offer the copyable link as
 * a fallback when no email provider is configured (spec §6 Step 4).
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
    const result = await new SendPlanProposal(
      new PrismaDisbursementRepository(),
      new PrismaBeneficiaryRepository(),
      new PrismaOrganizationRepository(),
      new PrismaPlanVersionRepository(),
      new PrismaLedgerEventRepository(),
      createEmailAdapter(),
      new CreateInvitation(
        new PrismaDisbursementRepository(),
        new PrismaRecipientInvitationRepository(),
        new PrismaLedgerEventRepository(),
      ),
    ).execute({ coordinatorId: session.user.id, disbursementId: id, appUrl: env.APP_URL });

    logger.info(
      {
        event: "plan_proposal_sent",
        disbursementId: id,
        invitationId: result.invitationId,
        planVersionNumber: result.planVersionNumber,
        delivered: result.delivered,
        provider: result.provider,
      },
      "Plan proposal sent",
    );

    return withSecurityHeaders(
      NextResponse.json({
        url: result.url,
        expiresAt: result.expiresAt.toISOString(),
        delivered: result.delivered,
        provider: result.provider,
        planVersionNumber: result.planVersionNumber,
      }),
    );
  } catch (error) {
    logger.error(
      { event: "plan_proposal_failed", disbursementId: id },
      error instanceof Error ? error.message : "Could not send the plan proposal",
    );
    if (error instanceof DisbursementNotFoundError) {
      return withSecurityHeaders(NextResponse.json({ error: error.message }, { status: 404 }));
    }
    if (error instanceof CoordinatorMismatchError) {
      return withSecurityHeaders(NextResponse.json({ error: error.message }, { status: 403 }));
    }
    if (error instanceof MissingPlanError) {
      return withSecurityHeaders(NextResponse.json({ error: error.message }, { status: 409 }));
    }
    if (error instanceof MissingEmailError) {
      return withSecurityHeaders(NextResponse.json({ error: error.message }, { status: 409 }));
    }
    return withSecurityHeaders(
      NextResponse.json(
        { error: error instanceof Error ? error.message : "Could not send the plan proposal" },
        { status: 500 },
      ),
    );
  }
}
