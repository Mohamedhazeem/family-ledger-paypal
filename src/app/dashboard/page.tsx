import { prisma } from "@/infrastructure/db/prisma";
import { formatMinor } from "@/domain/value-objects/money";
import { visibleTimeline } from "@/domain/timeline";
import { computeDashboardMetrics } from "@/lib/metrics";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DisbursementGrid, type DisbursementRow } from "./disbursement-grid";

const STAT_TONES = [
  "from-indigo-500 to-violet-500",
  "from-slate-800 to-slate-600",
  "from-emerald-500 to-teal-500",
  "from-amber-500 to-orange-500",
  "from-sky-500 to-blue-500",
  "from-rose-500 to-pink-500",
];

export default async function DashboardPage() {
  const rows = await prisma.disbursement.findMany({
    where: { deletedAt: null },
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
    { label: "Disbursements", value: metrics.totalDisbursements.toString() },
    { label: "Total amount", value: `$${formatMinor(rows.reduce((acc, r) => acc + r.amountMinor, 0n))}` },
    { label: "Total sent", value: `$${formatMinor(metrics.totalSentMinor)}` },
    { label: "Pending", value: metrics.pendingCount.toString() },
    { label: "Awaiting review", value: metrics.awaitingReviewCount.toString() },
    { label: "Failed / unclaimed", value: metrics.failedOrUnclaimedCount.toString() },
  ];

  return (
    <div className="space-y-6 sm:space-y-8">
      <section className="overflow-hidden rounded-3xl bg-slate-950 text-white">
        <div className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-indigo-300">Consent-first support</p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">Overview</h1>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-slate-300 sm:text-base">
              Make the support plan clear before the money moves. Payment and plan stay separate.
            </p>
          </div>
          <Badge tone="info">Sandbox</Badge>
        </div>
      </section>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {stats.map((s, i) => (
          <Card key={s.label}>
            <CardContent className="pt-5">
              <div className={`h-1.5 w-10 rounded-full bg-gradient-to-r ${STAT_TONES[i % STAT_TONES.length]}`} />
              <p className="mt-3 text-sm text-slate-500">{s.label}</p>
              <p className="mt-1 text-3xl font-bold tracking-tight tabular-nums text-slate-900">{s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <Card>
          <CardHeader title="Disbursement register" description="All disbursements, most recent first." />
          <CardContent>
            <DisbursementGrid rows={gridRows} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader title="Recent activity" description="Latest ledger events across the programme." />
          <CardContent>
            {metrics.recentActivity.length === 0 ? (
              <p className="py-8 text-center text-sm text-slate-500">No activity yet.</p>
            ) : (
              <ol className="relative space-y-5 border-l-2 border-slate-100 pl-5">
                {metrics.recentActivity.map((entry, index) => (
                  <li key={`${entry.eventType}-${index}`} className="relative">
                    <span className="absolute -left-[27px] top-1 h-3 w-3 rounded-full border-2 border-white bg-indigo-500 shadow" />
                    <p className="text-sm font-medium leading-snug text-slate-700">{entry.label}</p>
                    <time className="mt-1 block text-xs tabular-nums text-slate-400">
                      {entry.createdAt.toLocaleString()}
                    </time>
                  </li>
                ))}
              </ol>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
