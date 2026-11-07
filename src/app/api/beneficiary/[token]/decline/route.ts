import "server-only";
import { NextResponse } from "next/server";
import { withSecurityHeaders } from "@/lib/security/headers";
import { headers } from "next/headers";
import { DeclineToShare } from "@/application/use-cases/decline-to-share";
import { InvitationNotFoundError } from "@/application/use-cases/get-invitation-view";
import {
  PrismaDisbursementRepository,
  PrismaLedgerEventRepository,
  PrismaRecipientInvitationRepository,
} from "@/infrastructure/db/repositories";
import { RateLimit } from "@/lib/security/rate-limit";

/**
 * POST /api/beneficiary/[token]/decline (Slice 3.5, spec §6 Step 5).
 * Public mutation authorized by the invitation token alone.
 * Rate-limited per IP (ADR-0007).
 */
const mutationLimit = new RateLimit({ max: 10, windowMs: 60_000 });

export async function POST(
  _request: Request,
  context: { params: Promise<{ token: string }> },
) {
  const { token } = await context.params;
  const requestHeaders = await headers();
  const ip = requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (!mutationLimit.check(`decline:${ip}`)) {
    return withSecurityHeaders(NextResponse.json({ error: "Too many requests" }, { status: 429 }));
  }
  try {
    const result = await new DeclineToShare(
      new PrismaRecipientInvitationRepository(),
      new PrismaDisbursementRepository(),
      new PrismaLedgerEventRepository(),
    ).execute(token);
    return withSecurityHeaders(NextResponse.json(result));
  } catch (error) {
    if (error instanceof InvitationNotFoundError) {
      return withSecurityHeaders(NextResponse.json({ error: error.message }, { status: 404 }));
    }
    return withSecurityHeaders(NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not record your choice" },
      { status: 500 },
    ));
  }
}
