// @vitest-environment node
/**
 * Slice 5.5: dashboard metrics (spec §14B). Real database rows are
 * counted into the exact six metrics plus recent activity.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";

function loadEnvFile(): void {
  try {
    const content = readFileSync(join(process.cwd(), ".env"), "utf8");
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      const value = trimmed.slice(eq + 1).trim().replace(/^"(.*)"$/, "$1");
      if (key && !(key in process.env)) process.env[key] = value;
    }
  } catch {
    /* ignore */
  }
}
loadEnvFile();

const { prisma } = await import("@/infrastructure/db/prisma");
const { computeDashboardMetrics } = await import("@/lib/metrics");
const { visibleTimeline } = await import("@/domain/timeline");

afterAll(async () => {
  await prisma.$disconnect();
});

describe("dashboard metrics (Slice 5.5)", () => {
  it("counts the seeded database identically in code and SQL", async () => {
    const org = await prisma.organization.findUniqueOrThrow({ where: { id: "seed-org-cfsp" } });
    const disbursements = await prisma.disbursement.findMany({
      where: { organizationId: org.id },
      select: { planStatus: true, paymentStatus: true, amountMinor: true },
    });
    const revisionCount = await prisma.planVersion.count({
      where: { disbursement: { organizationId: org.id }, versionNumber: { gt: 1 } },
    });
    const events = await prisma.ledgerEvent.findMany({
      where: { disbursement: { organizationId: org.id } },
      orderBy: { createdAt: "desc" },
      take: 5,
    });

    const metrics = computeDashboardMetrics(disbursements, revisionCount, visibleTimeline(events, "coordinator"));

    const sent = disbursements
      .filter((d) => d.paymentStatus === "SUCCESS")
      .reduce((acc, d) => acc + d.amountMinor, 0n);
    expect(metrics.totalSentMinor).toBe(sent);
    expect(metrics.totalDisbursements).toBe(disbursements.length);
    expect(metrics.pendingCount).toBe(
      await prisma.disbursement.count({
        where: { organizationId: org.id, paymentStatus: { in: ["NOT_SENT", "READY"] } },
      }),
    );
    expect(metrics.awaitingReviewCount).toBe(
      await prisma.disbursement.count({
        where: { organizationId: org.id, planStatus: "REVISION_PROPOSED" },
      }),
    );
    expect(metrics.revisionCount).toBe(revisionCount);

    const failedExpected = await prisma.disbursement.count({
      where: { organizationId: org.id, paymentStatus: { in: ["FAILED", "UNCLAIMED", "RETURNED", "REFUNDED", "REVERSED"] } },
    });
    expect(metrics.failedOrUnclaimedCount).toBe(failedExpected);
    expect(metrics.recentActivity.length).toBe(Math.min(5, events.length));
  });
});
