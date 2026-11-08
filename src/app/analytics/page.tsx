import Link from "next/link";
import { notFound } from "next/navigation";
import { BarChart3 } from "lucide-react";
import { PrismaAnalyticsAdapter } from "@/infrastructure/analytics/prisma";
import { PrismaUserRepository } from "@/infrastructure/db/repositories";
import { getSession } from "@/lib/auth/session";
import { AnalyticsWorkspace } from "@/components/analytics/analytics-workspace";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatMinor } from "@/domain/value-objects/money";
import type { AnalyticsSnapshot } from "@/application/ports/analytics";

/**
 * GET /analytics (Slice 5.1, Part D §14G, ADR-0010).
 * Server Component: aggregates are fetched server-side from the real DB
 * (org-scoped, aggregate-only) and handed to the workspace as an initial
 * snapshot — no client "Loading…" guesswork, and an honest empty state
 * when the programme has no rows yet.
 */
async function loadSnapshot(): Promise<AnalyticsSnapshot | null> {
  const session = await getSession();
  if (!session) return null;
  const user = await new PrismaUserRepository().findById(session.user.id);
  if (!user?.organizationId) return null;
  return new PrismaAnalyticsAdapter().getAggregates(user.organizationId);
}

export default async function AnalyticsPage() {
  const snapshot = await loadSnapshot();
  if (!snapshot) notFound();

  const empty = snapshot.totalDisbursements === 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Analytics</h1>
          <p className="text-sm text-slate-500">
            Aggregate programme performance — counts and totals only, never personal data.
          </p>
        </div>
        <Badge tone="info">Aggregate-only</Badge>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent>
            <p className="text-sm text-slate-500">Disbursements</p>
            <p className="mt-2 text-2xl font-bold tabular-nums text-slate-900">
              {snapshot.totalDisbursements}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <p className="text-sm text-slate-500">Total amount</p>
            <p className="mt-2 text-2xl font-bold tabular-nums text-slate-900">
              ${formatMinor(BigInt(snapshot.totalAmountMinor))}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <p className="text-sm text-slate-500">Plan categories</p>
            <p className="mt-2 text-2xl font-bold tabular-nums text-slate-900">
              {snapshot.categories.length}
            </p>
          </CardContent>
        </Card>
      </div>

      {empty ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <BarChart3 className="h-10 w-10 text-slate-300" />
            <p className="text-sm text-slate-600">
              No programme data yet. Create a disbursement and the aggregates
              will appear here.
            </p>
            <Link
              href="/disbursements/new"
              className="text-sm font-medium text-indigo-600 hover:text-indigo-700"
            >
              New disbursement
            </Link>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader
            title="Programme workspace"
            description={
              process.env.AG_STUDIO_LICENSE_KEY
                ? "AG Studio embedded dashboard over the same aggregates."
                : "AG Grid fallback over the same aggregates (no sponsor licence key configured)."
            }
          />
          <CardContent className="pt-4">
            <AnalyticsWorkspace
              licenseKey={process.env.AG_STUDIO_LICENSE_KEY}
              initialSnapshot={snapshot}
            />
          </CardContent>
        </Card>
      )}

      {!empty ? (
        <Card>
          <CardHeader title="Status breakdown" description="Counts by status — nothing identifiable." />
          <CardContent className="space-y-4 pt-4">
            <div>
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-400">Plan status</p>
              <div className="flex flex-wrap gap-2">
                {snapshot.byPlanStatus.map((row) => (
                  <span
                    key={row.status}
                    className="rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-xs text-indigo-700"
                  >
                    {row.status}: <span className="font-semibold">{row.count}</span>
                  </span>
                ))}
              </div>
            </div>
            <div>
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-400">Payment status</p>
              <div className="flex flex-wrap gap-2">
                {snapshot.byPaymentStatus.map((row) => (
                  <span
                    key={row.status}
                    className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs text-emerald-700"
                  >
                    {row.status}: <span className="font-semibold">{row.count}</span>
                  </span>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
