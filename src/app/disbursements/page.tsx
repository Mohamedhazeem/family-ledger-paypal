import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowUpRight, CheckCircle2, Plus, Wallet } from "lucide-react";
import { prisma } from "@/infrastructure/db/prisma";
import { getSession } from "@/lib/auth/session";
import { formatMinor } from "@/domain/value-objects/money";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { DisbursementGrid, type DisbursementRow } from "@/app/dashboard/disbursement-grid";

/**
 * GET /disbursements (spec §14D): the full register — same data source and
 * grid as the dashboard, with programme totals at the top. Async Server
 * Component; row clicks open the detail page.
 */
export default async function DisbursementsPage() {
  const session = await getSession();
  if (!session) notFound();

  const rows = await prisma.disbursement.findMany({
    include: { beneficiary: true },
    orderBy: { createdAt: "desc" },
  });

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

  const total = rows.reduce((acc, r) => acc + r.amountMinor, 0n);
  const pending = rows.filter(
    (r) => r.paymentStatus === "NOT_SENT" || r.paymentStatus === "READY",
  ).length;
  const success = rows.filter((r) => r.paymentStatus === "SUCCESS").length;

  const stats = [
    { label: "Disbursements", value: rows.length.toString(), sub: "in this programme", icon: Wallet, color: "bg-indigo-100 text-indigo-700" },
    { label: "Total amount", value: `$${formatMinor(total)}`, sub: "USD, unrestricted", icon: Wallet, color: "bg-violet-100 text-violet-700" },
    { label: "Pending · Succeeded", value: `${pending} · ${success}`, sub: "payment state", icon: CheckCircle2, color: "bg-emerald-100 text-emerald-700" },
  ];

  return (
    <div className="space-y-6 sm:space-y-8">
      <section className="overflow-hidden rounded-3xl bg-slate-950 text-white">
        <div className="grid gap-6 p-6 sm:p-8 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-indigo-300">Programme register</p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">Disbursements</h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-300 sm:text-base">
              Every disbursement in one place. Search, filter, and open any row for its plan, payment, and timeline.
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row lg:flex-col">
            <Link
              href="/disbursements/new"
              className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-indigo-500 to-violet-500 px-5 text-sm font-semibold text-white shadow-lg shadow-indigo-950/40 transition hover:brightness-110"
            >
              <Plus className="h-4 w-4" />
              New disbursement
            </Link>
          </div>
        </div>
      </section>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {stats.map((s) => {
          const Icon = s.icon;
          return (
            <Card key={s.label}>
              <CardContent className="flex items-start justify-between gap-3 pt-5">
                <div>
                  <p className="text-sm text-slate-500">{s.label}</p>
                  <p className="mt-2 text-3xl font-bold tracking-tight tabular-nums text-slate-900">{s.value}</p>
                  <p className="mt-1 text-xs text-slate-400">{s.sub}</p>
                </div>
                <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${s.color}`}>
                  <Icon className="h-5 w-5" />
                </span>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardHeader
          title="Disbursement register"
          description="All disbursements, most recent first. Click a row to open its detail."
          action={
            <Link href="/dashboard" className="inline-flex items-center gap-1 text-sm font-medium text-indigo-600 hover:text-indigo-800">
              Overview <ArrowUpRight className="h-4 w-4" />
            </Link>
          }
        />
        <CardContent>
          <DisbursementGrid rows={gridRows} />
        </CardContent>
      </Card>
    </div>
  );
}
