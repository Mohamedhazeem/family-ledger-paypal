import { prisma } from "@/infrastructure/db/prisma";
import { formatMinor } from "@/domain/value-objects/money";
import { visibleTimeline } from "@/domain/timeline";
import { computeDashboardMetrics } from "@/lib/metrics";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DisbursementGrid, type DisbursementRow } from "./disbursement-grid";

export default async function DashboardPage() {
  const rows = await prisma.disbursement.findMany({
    include: { beneficiary: true },
    orderBy: { createdAt: "desc" },
  });

  const revisionCount = await prisma.planVersion.count({
    where: { versionNumber: { gt: 1 } },
  });
  const recentEvents = await prisma.ledgerEvent.findMany({
    orderBy: { createdAt: "desc" },
    take: 5,
  });
  const metrics = computeDashboardMetrics(
    rows,
    revisionCount,
    visibleTimeline(recentEvents, "coordinator"),
  );

  const gridRows: DisbursementRow[] = rows.map((r) => ({
    id: r.id,
    publicReference: r.publicReference,
    beneficiary: r.beneficiary.displayName,
    amountMinor: r.amountMinor.toString(),
    planStatus: r.planStatus,
    paypalBatchStatus: r.paypalBatchStatus,
    paypalItemStatus: r.paypalItemStatus,
    createdAt: r.createdAt.toISOString(),
  }));

  const stats = [
    { label: "Disbursements", value: metrics.totalDisbursements.toString(), tone: "info" as const },
    { label: "Total amount", value: `$${formatMinor(rows.reduce((acc, r) => acc + r.amountMinor, 0n))}`, tone: "neutral" as const },
    { label: "Total sent", value: `$${formatMinor(metrics.totalSentMinor)}`, tone: "success" as const },
    { label: "Pending", value: metrics.pendingCount.toString(), tone: "warning" as const },
    { label: "Awaiting review", value: metrics.awaitingReviewCount.toString(), tone: "warning" as const },
    { label: "Failed / unclaimed", value: metrics.failedOrUnclaimedCount.toString(), tone: "danger" as const },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Overview</h1>
          <p className="text-sm text-slate-500">Disbursement register and status at a glance.</p>
        </div>
        <Badge tone="info">Sandbox</Badge>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {stats.map((s) => (
          <Card key={s.label}>
            <CardContent>
              <p className="text-sm text-slate-500">{s.label}</p>
              <p className="mt-2 text-2xl font-bold text-slate-900">{s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader title="Recent activity" description="Latest ledger events across the programme." />
        <CardContent className="pt-4">
          {metrics.recentActivity.length === 0 ? (
            <p className="text-sm text-slate-500">No activity yet.</p>
          ) : (
            <ol className="space-y-2">
              {metrics.recentActivity.map((entry, index) => (
                <li
                  key={`${entry.eventType}-${index}`}
                  className="flex items-baseline justify-between gap-3 text-sm"
                >
                  <span className="text-slate-700">{entry.label}</span>
                  <time className="shrink-0 text-xs tabular-nums text-slate-400">
                    {entry.createdAt.toLocaleString()}
                  </time>
                </li>
              ))}
            </ol>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader title="Disbursement register" description="All disbursements, most recent first." />
        <CardContent className="pt-4">
          <DisbursementGrid rows={gridRows} />
        </CardContent>
      </Card>
    </div>
  );
}
