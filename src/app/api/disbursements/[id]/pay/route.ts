import "server-only";
import { NextResponse } from "next/server";
import {
  CoordinatorMismatchError,
  DisbursementNotFoundError,
  SubmitPayout,
} from "@/application/use-cases/submit-payout";
import {
  PrismaBeneficiaryRepository,
  PrismaDisbursementRepository,
  PrismaLedgerEventRepository,
  PrismaPayoutAttemptRepository,
} from "@/infrastructure/db/repositories";
import { createPayoutsAdapter } from "@/infrastructure/paypal/factory";
import { requireSession } from "@/lib/auth/session";
import { withSecurityHeaders } from "@/lib/security/headers";
import { isSameOrigin } from "@/lib/security/csrf";
import { logger } from "@/lib/log";

/**
 * POST /api/disbursements/[id]/pay (Slice 4.3, spec §6 Step 8).
 * Coordinator-only. One explicit action per click: commits the
 * attempt row first, then sends one full-amount sandbox payout.
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
    const result = await new SubmitPayout(
      new PrismaDisbursementRepository(),
      new PrismaPayoutAttemptRepository(),
      new PrismaBeneficiaryRepository(),
      new PrismaLedgerEventRepository(),
      createPayoutsAdapter(),
    ).execute({ coordinatorId: session.user.id, disbursementId: id });
    logger.info(
      {
        event: "payout_submitted",
        disbursementId: id,
        senderBatchId: result.senderBatchId,
        paymentStatus: result.paymentStatus,
      },
      "Payout submitted",
    );
    return withSecurityHeaders(NextResponse.json(result));
  } catch (error) {
    logger.error(
      { event: "payout_submit_failed", disbursementId: id },
      error instanceof Error ? error.message : "Could not submit the payout",
    );
    if (error instanceof DisbursementNotFoundError) {
      return withSecurityHeaders(NextResponse.json({ error: error.message }, { status: 404 }));
    }
    if (error instanceof CoordinatorMismatchError) {
      return withSecurityHeaders(NextResponse.json({ error: error.message }, { status: 403 }));
    }
    return withSecurityHeaders(NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not submit the payout" },
      { status: 500 },
    ));
  }
}
