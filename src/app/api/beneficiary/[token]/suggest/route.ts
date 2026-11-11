import "server-only";
import { NextResponse } from "next/server";
import { withSecurityHeaders } from "@/lib/security/headers";
import { headers } from "next/headers";
import { z } from "zod";
import { ProposeRevision } from "@/application/use-cases/propose-revision";
import { InvitationNotFoundError } from "@/application/use-cases/get-invitation-view";
import {
  PrismaDisbursementRepository,
  PrismaLedgerEventRepository,
  PrismaPlanClarificationRepository,
  PrismaPlanVersionRepository,
  PrismaRecipientInvitationRepository,
} from "@/infrastructure/db/repositories";
import { RateLimit } from "@/lib/security/rate-limit";

/**
 * POST /api/beneficiary/[token]/suggest (Slice 3.4, spec §6 Step 5).
 * Public mutation authorized by the invitation token alone.
 * Rate-limited per IP (ADR-0007).
 */
const mutationLimit = new RateLimit({ max: 10, windowMs: 60_000 });

const RequestSchema = z.object({
  items: z.array(
    z.object({
      category: z.string().trim().min(1),
      amountText: z.string().regex(/^\d+(?:\.\d{1,2})?$/).nullable(),
      description: z.string().nullable().optional(),
    }),
  ),
  explanation: z.string().trim().max(2000).nullable().optional(),
});

export async function POST(
  request: Request,
  context: { params: Promise<{ token: string }> },
) {
  const { token } = await context.params;
  const requestHeaders = await headers();
  const ip = requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (!mutationLimit.check(`suggest:${ip}`)) {
    return withSecurityHeaders(NextResponse.json({ error: "Too many requests" }, { status: 429 }));
  }

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
    const result = await new ProposeRevision(
      new PrismaRecipientInvitationRepository(),
      new PrismaDisbursementRepository(),
      new PrismaPlanVersionRepository(),
      new PrismaLedgerEventRepository(),
      new PrismaPlanClarificationRepository(),
    ).execute(token, {
      items: parsed.data.items.map((item) => ({
        category: item.category,
        amountText: item.amountText,
        description: item.description,
      })),
      explanation: parsed.data.explanation,
    });
    return withSecurityHeaders(NextResponse.json(result));
  } catch (error) {
    if (error instanceof InvitationNotFoundError) {
      return withSecurityHeaders(NextResponse.json({ error: error.message }, { status: 404 }));
    }
    const message = error instanceof Error ? error.message : "Could not submit the revision";
    const status = message.startsWith("Allocations exceed") ? 400 : 500;
    return withSecurityHeaders(NextResponse.json({ error: message }, { status }));
  }
}
