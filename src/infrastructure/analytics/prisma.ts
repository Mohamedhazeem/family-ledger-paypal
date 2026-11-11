import "server-only";
import type {
  AnalyticsPort,
  AnalyticsSnapshot,
  CategoryTotal,
} from "@/application/ports/analytics";
import { prisma } from "@/infrastructure/db/prisma";

/**
 * Aggregate analytics adapter (Slice 5.1, ADR-0010).
 * Server-side only; exposes status counts and per-category sums.
 * Selected rows exclude every PII column by construction —
 * only category names (plan labels) enter the DTOs.
 */
export class PrismaAnalyticsAdapter implements AnalyticsPort {
  async getAggregates(organizationId: string): Promise<AnalyticsSnapshot> {
    const disbursements = await prisma.disbursement.findMany({
      where: { organizationId, deletedAt: null },
      select: {
        amountMinor: true,
        planStatus: true,
        paymentStatus: true,
        payoutAttempts: { select: { attemptState: true } },
        planVersions: {
          orderBy: { versionNumber: "desc" },
          take: 1,
          select: {
            items: { select: { category: true, amountMinor: true } },
          },
        },
      },
    });

    const totalAmountMinor = disbursements.reduce((acc, d) => acc + d.amountMinor, 0n);
    const byPlanStatus = group(disbursements.map((d) => d.planStatus));
    const byPaymentStatus = group(disbursements.map((d) => d.paymentStatus));
    const byAttemptState = group(
      disbursements.flatMap((d) => d.payoutAttempts.map((a) => a.attemptState)),
    );

    const categoryTotals = new Map<string, CategoryTotal>();
    for (const disbursement of disbursements) {
      const latest = disbursement.planVersions[0];
      for (const item of latest?.items ?? []) {
        const existing = categoryTotals.get(item.category) ?? {
          category: item.category,
          amountMinor: "0",
          itemCount: 0,
        };
        existing.itemCount += 1;
        const sum = BigInt(existing.amountMinor) + (item.amountMinor ?? 0n);
        existing.amountMinor = sum.toString();
        categoryTotals.set(item.category, existing);
      }
    }

    return {
      organizationId,
      totalDisbursements: disbursements.length,
      totalAmountMinor: totalAmountMinor.toString(),
      byPlanStatus,
      byPaymentStatus,
      byAttemptState,
      categories: [...categoryTotals.values()].sort((a, b) => a.category.localeCompare(b.category)),
      generatedAt: new Date().toISOString(),
    };
  }
}

function group(values: string[]): { status: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const value of values) {
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([status, count]) => ({ status, count }))
    .sort((a, b) => b.count - a.count || a.status.localeCompare(b.status));
}
