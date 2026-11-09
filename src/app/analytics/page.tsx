import Link from "next/link";
import { notFound } from "next/navigation";
import { BarChart3 } from "lucide-react";
import { PrismaAnalyticsAdapter } from "@/infrastructure/analytics/prisma";
import { PrismaUserRepository } from "@/infrastructure/db/repositories";
import { getSession } from "@/lib/auth/session";
import { AnalyticsWorkspace } from "@/components/analytics/analytics-workspace";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
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
    <div className="space-y-6 sm:space-y-8">
      <section className="overflow-hidden rounded-3xl bg-slate-950 text-white">
        <div className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-indigo-300">Aggregate insights</p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">Analytics</h1>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-slate-300 sm:text-base">
              Counts and totals only — never personal data. Plan and payment stay separate.
            </p>
          </div>
        </div>
      </section>

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
                ? "AG Studio board over the same aggregates — opens pre-built; switch to Customise to drag in your own widgets."
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
          <CardHeader title="Category breakdown" description="Allocated amounts by category — aggregate only." />
          <CardContent className="space-y-3 pt-4">
            {snapshot.categories.length === 0 ? (
              <p className="text-sm text-slate-500">No categories yet.</p>
            ) : (
              <ul className="space-y-3">
                {snapshot.categories.map((row) => {
                  const max = Math.max(...snapshot.categories.map((r) => Number(r.amountMinor)));
                  const pct = max > 0 ? (Number(row.amountMinor) / max) * 100 : 0;
                  return (
                    <li key={row.category} className="space-y-1.5">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium text-slate-700">{row.category}</span>
                        <span className="tabular-nums text-slate-500">
                          ${formatMinor(BigInt(row.amountMinor))} · {row.itemCount} items
                        </span>
                      </div>
                      <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
                        <div className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-violet-500" style={{ width: `${pct}%` }} />
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      ) : null}

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
