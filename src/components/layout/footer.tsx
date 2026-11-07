import Link from "next/link";

export function Footer() {
  return (
    <footer className="border-t border-slate-200 bg-white">
      <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-10 sm:px-6 lg:px-8 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="font-semibold text-slate-900">FamilyLedger 2.0</p>
          <p className="mt-1 text-sm text-slate-500">
            Consent-first, AI-assisted family-support disbursement. Sandbox only, synthetic data.
          </p>
        </div>
        <div className="flex gap-6 text-sm text-slate-500">
          <Link href="/login" className="hover:text-slate-900">Sign in</Link>
          <Link href="/signup" className="hover:text-slate-900">Sign up</Link>
        </div>
      </div>
    </footer>
  );
}
