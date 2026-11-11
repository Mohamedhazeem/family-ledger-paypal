import "server-only";
import { NextResponse } from "next/server";
import { z } from "zod";
import {
  CoordinatorMismatchError,
  DisbursementNotFoundError,
  EmptyQuestionError,
  RequestClarification,
} from "@/application/use-cases/request-clarification";
import {
  PrismaDisbursementRepository,
  PrismaLedgerEventRepository,
  PrismaPlanClarificationRepository,
} from "@/infrastructure/db/repositories";
import { requireSession } from "@/lib/auth/session";
import { withSecurityHeaders } from "@/lib/security/headers";
import { isSameOrigin } from "@/lib/security/csrf";

/**
 * POST /api/disbursements/[id]/clarification (spec §6 Step 7, ADR-0019).
 * Coordinator-only: ask the beneficiary one clarification question.
 */
const RequestSchema = z.object({
  question: z.string().trim().min(1).max(2000),
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
    const result = await new RequestClarification(
      new PrismaDisbursementRepository(),
      new PrismaPlanClarificationRepository(),
      new PrismaLedgerEventRepository(),
    ).execute({
      coordinatorId: session.user.id,
      disbursementId: id,
      question: parsed.data.question,
    });
    return withSecurityHeaders(
      NextResponse.json({
        id: result.id,
        question: result.question,
        createdAt: result.createdAt.toISOString(),
      }),
    );
  } catch (error) {
    if (error instanceof DisbursementNotFoundError) {
      return withSecurityHeaders(NextResponse.json({ error: error.message }, { status: 404 }));
    }
    if (error instanceof CoordinatorMismatchError) {
      return withSecurityHeaders(NextResponse.json({ error: error.message }, { status: 403 }));
    }
    if (error instanceof EmptyQuestionError) {
      return withSecurityHeaders(NextResponse.json({ error: error.message }, { status: 400 }));
    }
    return withSecurityHeaders(NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not ask the question" },
      { status: 500 },
    ));
  }
}
