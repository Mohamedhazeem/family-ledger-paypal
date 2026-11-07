import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { NewDisbursementForm } from "@/components/disbursements/new-disbursement-form";

export default function NewDisbursementPage() {
  return (
    <div className="space-y-6">
      <div>
        <Link href="/disbursements" className="text-sm font-medium text-indigo-600 hover:text-indigo-700">
          <ArrowLeft className="mr-1 inline h-4 w-4" />
          Back to disbursements
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-slate-900">New disbursement</h1>
        <p className="text-sm text-slate-500">
          Add beneficiary details, extract the plan with AI, review it, then save.
        </p>
      </div>
      <NewDisbursementForm />
    </div>
  );
}
