import Link from "next/link";
import { ArrowLeft, Plus, Wallet } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export default function DisbursementsPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Disbursements</h1>
          <p className="text-sm text-slate-500">Manage and review disbursements from the overview.</p>
        </div>
        <Link
          href="/disbursements/new"
          className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 text-sm font-medium text-white shadow-sm transition hover:bg-indigo-700"
        >
          <Plus className="h-4 w-4" />
          New disbursement
        </Link>
      </div>
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
          <Wallet className="h-10 w-10 text-slate-300" />
          <p className="text-sm text-slate-600">Disbursement detail and creation flows are coming soon.</p>
          <Link href="/dashboard" className="text-sm font-medium text-indigo-600 hover:text-indigo-700">
            <ArrowLeft className="mr-1 inline h-4 w-4" />
            Back to overview
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
