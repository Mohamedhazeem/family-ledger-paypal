import "server-only";
import { NextResponse } from "next/server";
import { withSecurityHeaders } from "@/lib/security/headers";
import { prisma } from "@/infrastructure/db/prisma";

/**
 * GET /api/health (Slice 5.2): unauthenticated health check for
 * Render. Returns 200 when the database answers, 503 otherwise.
 * Safe: no secrets, routes, or PII are exposed.
 */
export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return withSecurityHeaders(NextResponse.json({ status: "ok" }));
  } catch {
    return withSecurityHeaders(NextResponse.json({ status: "degraded" }, { status: 503 }));
  }
}
