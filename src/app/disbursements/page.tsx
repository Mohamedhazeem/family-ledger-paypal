import Link from "next/link";
import { notFound } from "next/navigation";
import { Plus } from "lucide-react";
import { prisma } from "@/infrastructure/db/prisma";
import { getSession } from "@/lib/auth/session";
import { formatMinor } from "@/domain/value-objects/money";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Disbursements</h1>
          <p className="text-sm text-slate-500">
            Every disbursement in the programme — click a row to open its detail.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Badge tone="info">Sandbox</Badge>
          <Link
            href="/disbursements/new"
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 text-sm font-medium text-white shadow-sm transition hover:bg-indigo-700"
          >
            <Plus className="h-4 w-4" />
            New disbursement
          </Link>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent>
            <p className="text-sm text-slate-500">Disbursements</p>
            <p className="mt-2 text-2xl font-bold text-slate-900">{rows.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <p className="text-sm text-slate-500">Total amount</p>
            <p className="mt-2 text-2xl font-bold tabular-nums text-slate-900">
              ${formatMinor(total)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <p className="text-sm text-slate-500">Pending · Succeeded</p>
            <p className="mt-2 text-2xl font-bold text-slate-900">
              {pending} · <span className="text-emerald-600">{success}</span>
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader title="Disbursement register" description="All disbursements, most recent first." />
        <CardContent className="pt-4">
          <DisbursementGrid rows={gridRows} />
        </CardContent>
      </Card>
    </div>
  );
}
