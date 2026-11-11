import "server-only";
import { NextResponse } from "next/server";
import { z } from "zod";
import {
  CoordinatorMismatchError,
  DisbursementNotFoundError,
  InvalidTotalError,
  OverTotalError,
  PlanLockedError,
  ProposeCoordinatorRevision,
} from "@/application/use-cases/propose-coordinator-revision";
import {
  PrismaDisbursementRepository,
  PrismaLedgerEventRepository,
  PrismaPlanVersionRepository,
} from "@/infrastructure/db/repositories";
import { requireSession } from "@/lib/auth/session";
import { withSecurityHeaders } from "@/lib/security/headers";
import { isSameOrigin } from "@/lib/security/csrf";

/**
 * POST /api/disbursements/[id]/revise (ADR-0019).
 * Coordinator-only: adjust categories and/or the full amount, appending
 * a new immutable PlanVersion. Guarded to NOT_SENT disbursements.
 */
const RequestSchema = z.object({
  totalText: z.string().regex(/^\d+(?:\.\d{1,2})?$/).optional(),
  items: z.array(
    z.object({
      category: z.string().trim().min(1),
      amountText: z.string().regex(/^\d+(?:\.\d{1,2})?$/).nullable(),
    }),
  ),
});

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

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return withSecurityHeaders(NextResponse.json({ error: "Invalid JSON body" }, { status: 400 }));
  }
  const parsed = RequestSchema.safeParse(body);
  if (!parsed.success) {
    return withSecurityHeaders(NextResponse.json(
      { error: "Invalid request body", issues: parsed.error.issues },
      { status: 400 },
    ));
  }

  try {
    const result = await new ProposeCoordinatorRevision(
      new PrismaDisbursementRepository(),
      new PrismaPlanVersionRepository(),
      new PrismaLedgerEventRepository(),
    ).execute({
      coordinatorId: session.user.id,
      disbursementId: id,
      totalText: parsed.data.totalText,
      items: parsed.data.items,
    });
    return withSecurityHeaders(NextResponse.json(result));
  } catch (error) {
    if (error instanceof DisbursementNotFoundError) {
      return withSecurityHeaders(NextResponse.json({ error: error.message }, { status: 404 }));
    }
    if (error instanceof CoordinatorMismatchError) {
      return withSecurityHeaders(NextResponse.json({ error: error.message }, { status: 403 }));
    }
    if (error instanceof PlanLockedError) {
      return withSecurityHeaders(NextResponse.json({ error: error.message }, { status: 409 }));
    }
    if (error instanceof OverTotalError || error instanceof InvalidTotalError) {
      return withSecurityHeaders(NextResponse.json({ error: error.message }, { status: 400 }));
    }
    return withSecurityHeaders(NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not update the proposal" },
      { status: 500 },
    ));
  }
}
