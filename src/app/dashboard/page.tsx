import { prisma } from "@/infrastructure/db/prisma";
import { formatMinor } from "@/domain/value-objects/money";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DisbursementGrid, type DisbursementRow } from "./disbursement-grid";

export default async function DashboardPage() {
  const rows = await prisma.disbursement.findMany({
    include: { beneficiary: true },
    orderBy: { createdAt: "desc" },
  });

  const totalMinor = rows.reduce((acc, r) => acc + r.amountMinor, 0n);
  const accepted = rows.filter((r) => r.planStatus === "BENEFICIARY_ACCEPTED").length;
  const paid = rows.filter((r) => r.paymentStatus === "SUCCESS").length;

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
    { label: "Disbursements", value: rows.length.toString(), tone: "info" as const },
    { label: "Total amount", value: `$${formatMinor(totalMinor)}`, tone: "neutral" as const },
    { label: "Plans accepted", value: accepted.toString(), tone: "success" as const },
    { label: "Payments successful", value: paid.toString(), tone: "success" as const },
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

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
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
        <CardHeader title="Disbursement register" description="All disbursements, most recent first." />
        <CardContent className="pt-4">
          <DisbursementGrid rows={gridRows} />
        </CardContent>
      </Card>
    </div>
  );
}
