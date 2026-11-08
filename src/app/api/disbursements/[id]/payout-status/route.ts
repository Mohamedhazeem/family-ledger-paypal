import "server-only";
import { NextResponse } from "next/server";
import {
  DisbursementNotFoundError,
  GetPayoutStatus,
  NoPayoutSubmittedError,
} from "@/application/use-cases/get-payout-status";
import {
  PrismaDisbursementRepository,
  PrismaPayoutAttemptRepository,
} from "@/infrastructure/db/repositories";
import { createPayoutsAdapter } from "@/infrastructure/paypal/factory";
import { requireSession } from "@/lib/auth/session";
import { withSecurityHeaders } from "@/lib/security/headers";
import { logger } from "@/lib/log";

/**
 * GET /api/disbursements/[id]/payout-status (Slice 4.6, spec Step 9).
 * Coordinator-only. One explicit refresh per call; there is no
 * webhook or background polling in this slice.
 */
export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const session = await requireSession();
  if (!session) {
    return withSecurityHeaders(NextResponse.json({ error: "Unauthorized" }, { status: 401 }));
  }
  const { id } = await context.params;
  try {
    const result = await new GetPayoutStatus(
      new PrismaDisbursementRepository(),
      new PrismaPayoutAttemptRepository(),
      createPayoutsAdapter(),
    ).execute({ coordinatorId: session.user.id, disbursementId: id });
    logger.info(
      {
        event: "payout_status_refreshed",
        disbursementId: id,
        paymentStatus: result.paymentStatus,
      },
      "Payout status refreshed",
    );
    return withSecurityHeaders(NextResponse.json(result));
  } catch (error) {
    if (error instanceof DisbursementNotFoundError) {
      return withSecurityHeaders(NextResponse.json({ error: error.message }, { status: 404 }));
    }
    if (error instanceof NoPayoutSubmittedError) {
      return withSecurityHeaders(NextResponse.json({ error: error.message }, { status: 409 }));
    }
    return withSecurityHeaders(NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not refresh the payout status" },
      { status: 502 },
    ));
  }
}
