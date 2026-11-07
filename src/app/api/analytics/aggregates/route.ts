import "server-only";
import { NextResponse } from "next/server";
import { PrismaAnalyticsAdapter } from "@/infrastructure/analytics/prisma";
import { PrismaUserRepository } from "@/infrastructure/db/repositories";
import { requireSession } from "@/lib/auth/session";
import { withSecurityHeaders } from "@/lib/security/headers";

/**
 * GET /api/analytics/aggregates (Slice 5.1, ADR-0010).
 * Coordinator-only. Aggregate-only DTOs (no PII) for the sponsor
 * analytics workspace.
 */
export async function GET() {
  const session = await requireSession();
  if (!session) {
    return withSecurityHeaders(NextResponse.json({ error: "Unauthorized" }, { status: 401 }));
  }
  const user = await new PrismaUserRepository().findById(session.user.id);
  if (!user?.organizationId) {
    return withSecurityHeaders(NextResponse.json({ error: "Coordinator has no organization." }, { status: 500 }));
  }
  try {
    const snapshot = await new PrismaAnalyticsAdapter().getAggregates(user.organizationId);
    return withSecurityHeaders(NextResponse.json(snapshot));
  } catch (error) {
    return withSecurityHeaders(NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not load analytics" },
      { status: 500 },
    ));
  }
}
