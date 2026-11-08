import Link from "next/link";
import { ArrowLeft, ChevronRight, ShieldCheck, Sparkles } from "lucide-react";
import { NewDisbursementForm } from "@/components/disbursements/new-disbursement-form";

export default function NewDisbursementPage() {
  return (
    <div className="space-y-6">
      <div>
        <Link href="/disbursements" className="inline-flex items-center gap-1 text-sm font-medium text-indigo-600 hover:text-indigo-800">
          <ArrowLeft className="h-4 w-4" /> Back to disbursements
        </Link>
        <div className="mt-5 overflow-hidden rounded-3xl bg-slate-950 text-white">
          <div className="grid gap-6 p-6 sm:p-8 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-center">
            <div>
              <p className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-indigo-100"><Sparkles className="h-3.5 w-3.5" /> AI-assisted draft</p>
              <h1 className="mt-4 text-3xl font-bold tracking-tight">New disbursement</h1>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-300 sm:text-base">Add beneficiary details, let AI extract only what is explicitly stated, review the plan, then save version 1.</p>
            </div>
            <div className="grid gap-2 rounded-2xl bg-white/5 p-4 text-sm text-slate-300">
              <p className="flex items-center justify-between">Beneficiary <ChevronRight className="h-4 w-4 text-slate-500" /></p>
              <p className="flex items-center justify-between">AI extraction <ChevronRight className="h-4 w-4 text-slate-500" /></p>
              <p className="flex items-center justify-between font-medium text-white">Review &amp; save <ShieldCheck className="h-4 w-4 text-emerald-400" /></p>
            </div>
          </div>
        </div>
      </div>
      <NewDisbursementForm />
    </div>
  );
}
