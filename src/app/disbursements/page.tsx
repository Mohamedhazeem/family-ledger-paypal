import Link from "next/link";
import { ArrowLeft, Wallet } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export default function DisbursementsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Disbursements</h1>
        <p className="text-sm text-slate-500">Manage and review disbursements from the overview.</p>
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
