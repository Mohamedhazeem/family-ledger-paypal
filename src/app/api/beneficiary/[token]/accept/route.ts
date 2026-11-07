import "server-only";
import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { AcceptPlan } from "@/application/use-cases/accept-plan";
import { InvitationNotFoundError } from "@/application/use-cases/get-invitation-view";
import {
  PrismaDisbursementRepository,
  PrismaLedgerEventRepository,
  PrismaPlanVersionRepository,
  PrismaRecipientInvitationRepository,
} from "@/infrastructure/db/repositories";
import { RateLimit } from "@/lib/security/rate-limit";

/**
 * POST /api/beneficiary/[token]/accept (Slice 3.3, spec §6 Step 5).
 * Public mutation authorized by the invitation token alone (same
 * guards as the portal view). Rate-limited per IP (ADR-0007).
 */
const mutationLimit = new RateLimit({ max: 60, windowMs: 60_000 });

export async function POST(
  _request: Request,
  context: { params: Promise<{ token: string }> },
) {
  const { token } = await context.params;
  const requestHeaders = await headers();
  const ip = requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (!mutationLimit.check(`accept:${ip}`)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }
  try {
    const result = await new AcceptPlan(
      new PrismaRecipientInvitationRepository(),
      new PrismaDisbursementRepository(),
      new PrismaPlanVersionRepository(),
      new PrismaLedgerEventRepository(),
    ).execute(token);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof InvitationNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not accept the plan" },
      { status: 500 },
    );
  }
}
