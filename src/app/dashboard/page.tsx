import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/infrastructure/db/prisma";
import { DisbursementGrid, type DisbursementRow } from "./disbursement-grid";

export default async function DashboardPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const rows = await prisma.disbursement.findMany({
    include: { beneficiary: true },
    orderBy: { createdAt: "desc" },
  });

  const gridRows: DisbursementRow[] = rows.map((r) => ({
    publicReference: r.publicReference,
    beneficiary: r.beneficiary.displayName,
    amountMinor: r.amountMinor.toString(),
    planStatus: r.planStatus,
    paypalBatchStatus: r.paypalBatchStatus,
    paypalItemStatus: r.paypalItemStatus,
    createdAt: r.createdAt.toISOString(),
  }));

  return (
    <main className="p-6 space-y-4">
      <h1 className="text-2xl font-semibold">Disbursement register</h1>
      <p className="text-sm text-gray-600">Signed in as {session.user.email}</p>
      <DisbursementGrid rows={gridRows} />
    </main>
  );
}
