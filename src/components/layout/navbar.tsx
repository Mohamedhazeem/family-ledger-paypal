import Link from "next/link";
import { Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";

export function Navbar() {
  return (
    <header className="sticky top-0 z-40 border-b border-slate-200/70 bg-white/80 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-2 font-semibold text-slate-900">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-600 text-white">
            <Wallet className="h-5 w-5" />
          </span>
          Family Ledger
        </Link>
        <nav className="hidden items-center gap-6 text-sm text-slate-600 md:flex">
          <Link href="/#features" className="hover:text-slate-900">Features</Link>
          <Link href="/#how" className="hover:text-slate-900">How it works</Link>
          <Link href="/login" className="hover:text-slate-900">Sign in</Link>
        </nav>
        {/*<div className="flex items-center gap-4">
          <Link href="/login" className="hidden text-sm font-medium text-slate-700 sm:block">
            <Button size="sm">Sign in
            </Button>
          </Link>
          <Link href="/signup">
            <Button size="sm">Get started</Button>
          </Link>
        </div>*/}
        <div className="flex items-center gap-2">
          <Link href="/login" className="hidden text-sm font-medium text-slate-700 sm:block">
            <Button variant="outline" size="sm" className="w-26">Sign in</Button>
          </Link>
          <Link href="/signup">
            <Button size="sm" className="w-26">Get started</Button>
          </Link>
        </div>
      </div>
    </header>
  );
}
