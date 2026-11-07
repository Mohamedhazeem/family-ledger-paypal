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
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await context.params;
  try {
    const result = await new GetPayoutStatus(
      new PrismaDisbursementRepository(),
      new PrismaPayoutAttemptRepository(),
      createPayoutsAdapter(),
    ).execute({ coordinatorId: session.user.id, disbursementId: id });
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof DisbursementNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    if (error instanceof NoPayoutSubmittedError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not refresh the payout status" },
      { status: 502 },
    );
  }
}
