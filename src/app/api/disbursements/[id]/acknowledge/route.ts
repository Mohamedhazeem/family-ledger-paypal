import "server-only";
import { NextResponse } from "next/server";
import {
  AcknowledgePlan,
  CoordinatorMismatchError,
  DisbursementNotFoundError,
} from "@/application/use-cases/acknowledge-plan";
import {
  PrismaDisbursementRepository,
  PrismaLedgerEventRepository,
} from "@/infrastructure/db/repositories";
import { requireSession } from "@/lib/auth/session";

/**
 * POST /api/disbursements/[id]/acknowledge (Slice 3.7, spec §6 Step 7).
 * Coordinator-only: acknowledges the plan and logs a ledger event.
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
    const result = await new AcknowledgePlan(
      new PrismaDisbursementRepository(),
      new PrismaLedgerEventRepository(),
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
      { error: error instanceof Error ? error.message : "Could not acknowledge the plan" },
      { status: 500 },
    );
  }
}
