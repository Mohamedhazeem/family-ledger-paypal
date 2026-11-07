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

/**
 * POST /api/disbursements/[id]/pay (Slice 4.3, spec §6 Step 8).
 * Coordinator-only. One explicit action per click: commits the
 * attempt row first, then sends one full-amount sandbox payout.
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
    const result = await new SubmitPayout(
      new PrismaDisbursementRepository(),
      new PrismaPayoutAttemptRepository(),
      new PrismaBeneficiaryRepository(),
      new PrismaLedgerEventRepository(),
      createPayoutsAdapter(),
    ).execute({ coordinatorId: session.user.id, disbursementId: id });
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof DisbursementNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    if (error instanceof CoordinatorMismatchError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not submit the payout" },
      { status: 500 },
    );
  }
}
