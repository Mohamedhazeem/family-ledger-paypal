import React from "react";
import Link from "next/link";
import { Wallet } from "lucide-react";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="hidden flex-col justify-between bg-gradient-to-br from-slate-900 via-indigo-950 to-indigo-900 p-10 text-white lg:flex">
        <Link href="/" className="flex items-center gap-2 font-semibold">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10">
            <Wallet className="h-5 w-5" />
          </span>
          FamilyLedger
        </Link>
        <div>
          <h2 className="text-3xl font-bold">Consent-first support disbursement.</h2>
          <p className="mt-3 max-w-md text-slate-300">
            Agree on the plan before the money moves. One unrestricted PayPal payout, always.
          </p>
        </div>
        <p className="text-xs text-slate-400">Sandbox only · synthetic data · not production-ready.</p>
      </div>
      <div className="flex items-center justify-center p-6 sm:p-10">{children}</div>
    </div>
  );
}
