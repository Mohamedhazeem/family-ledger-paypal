"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  BarChart3,
  ChevronLeft,
  ChevronRight,
  LayoutDashboard,
  LogOut,
  Menu,
  Wallet,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";

const nav = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard, hint: "Programme at a glance" },
  { href: "/disbursements", label: "Disbursements", icon: Wallet, hint: "Register & detail" },
  { href: "/analytics", label: "Analytics", icon: BarChart3, hint: "Aggregate insights" },
];

function initials(name?: string | null): string {
  if (!name?.trim()) return "FL";
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("")
    .toUpperCase();
}

export function DashboardShell({
  user,
  children,
}: {
  user: { name?: string | null; email?: string | null };
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem("fl-sidebar-collapsed") === "1";
  });
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    localStorage.setItem("fl-sidebar-collapsed", collapsed ? "1" : "0");
  }, [collapsed]);

  async function logout() {
    await fetch("/api/auth/sign-out", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  const activeItem = nav.find((item) => pathname === item.href || pathname.startsWith(`${item.href}/`));

  function SidebarContent({ collapsed: c }: { collapsed: boolean }) {
    return (
      <div className="flex h-full flex-col bg-slate-950 text-slate-300">
        <div className={`flex items-center gap-3 px-4 py-5 ${c ? "justify-center px-2" : "px-5"}`}>
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 shadow-lg shadow-indigo-950/50">
            <Wallet className="h-5 w-5 text-white" />
          </span>
          {!c ? (
            <span className="min-w-0">
              <span className="block truncate font-semibold tracking-tight text-white">Family Ledger</span>
            </span>
          ) : null}
        </div>
        <div className={`px-2 pb-2 ${c ? "flex justify-center" : ""}`}>
          <button
            className="rounded-xl p-2 text-slate-400 transition hover:bg-white/5 hover:text-slate-100"
            onClick={() => setCollapsed((v) => !v)}
            aria-label={c ? "Expand sidebar" : "Collapse sidebar"}
            title={c ? "Expand sidebar" : "Collapse sidebar"}
          >
            {c ? <ChevronRight className="h-5 w-5" /> : <ChevronLeft className="h-5 w-5" />}
          </button>
        </div>

        {!c ? (
          <div className="px-5">
            <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-slate-500">Workspace</p>
          </div>
        ) : null}
        <nav className="flex-1 space-y-1.5 overflow-y-auto px-2 py-3 sm:px-3">
          {nav.map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                title={c ? item.label : undefined}
                className={`group flex items-center gap-3 rounded-2xl px-3 py-3 text-sm transition ${
                  c ? "justify-center" : ""
                } ${
                  active
                    ? "bg-gradient-to-r from-indigo-600/90 to-violet-600/80 text-white shadow-lg shadow-indigo-950/40"
                    : "text-slate-400 hover:bg-white/5 hover:text-slate-100"
                }`}
              >
                <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${active ? "bg-white/15" : "bg-white/5 group-hover:bg-white/10"}`}>
                  <Icon className="h-4 w-4" />
                </span>
                {!c ? (
                  <span className="min-w-0">
                    <span className="block font-medium">{item.label}</span>
                    <span className={`block truncate text-xs ${active ? "text-indigo-100/80" : "text-slate-500"}`}>{item.hint}</span>
                  </span>
                ) : null}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-white/10 p-3 sm:p-4">
          <div className={`mb-3 flex items-center gap-3 rounded-2xl bg-white/5 p-3 ${c ? "justify-center" : ""}`}>
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-indigo-500/25 text-xs font-bold text-indigo-200">
              {initials(user.name)}
            </span>
            {!c ? (
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-slate-100">{user.name ?? "Coordinator"}</p>
                <p className="truncate text-xs text-slate-500">{user.email}</p>
              </div>
            ) : null}
          </div>
          <Button
            variant="ghost"
            size="sm"
            className={`w-full justify-start text-slate-400 hover:bg-white/5 hover:text-slate-100 ${c ? "justify-center" : ""}`}
            onClick={logout}
            title={c ? "Sign out" : undefined}
          >
            <LogOut className="h-4 w-4" />
            {!c ? "Sign out" : null}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100">
      <div className={`lg:grid lg:min-h-screen ${collapsed ? "lg:grid-cols-[80px_minmax(0,1fr)]" : "lg:grid-cols-[280px_minmax(0,1fr)]"}`}>
        <aside className="sticky top-0 hidden h-screen overflow-hidden lg:block">
          {SidebarContent({ collapsed })}
        </aside>
        {open ? (
          <div className="fixed inset-0 z-50 lg:hidden">
            <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm" onClick={() => setOpen(false)} />
            <aside className="absolute left-0 top-0 h-full w-[300px] max-w-[85vw] overflow-hidden shadow-2xl">
              {SidebarContent({ collapsed: false })}
            </aside>
          </div>
        ) : null}
        <div className="flex min-h-screen min-w-0 flex-col">
          <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-slate-200/70 bg-white/85 px-4 backdrop-blur-xl sm:px-6 lg:px-8">
            <button
              className="rounded-xl p-2 text-slate-600 transition hover:bg-slate-100 lg:hidden"
              onClick={() => setOpen((v) => !v)}
              aria-label="Open menu"
            >
              {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold tracking-tight text-slate-900">{activeItem?.label ?? "Workspace"}</p>
              <p className="hidden truncate text-xs text-slate-500 sm:block">{activeItem?.hint ?? "Consent-first family support"}</p>
            </div>
            <div className="ml-auto flex items-center gap-2">
              <span className="hidden items-center gap-1.5 rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-[11px] font-medium text-indigo-700 sm:inline-flex">
                <span className="h-1.5 w-1.5 rounded-full bg-indigo-500" />
                Sandbox
              </span>
              <span className="hidden max-w-[220px] truncate rounded-full bg-slate-100 px-3 py-1.5 text-xs text-slate-600 md:inline-block">{user.email}</span>
            </div>
          </header>
          <main className="mx-auto w-full max-w-[1440px] flex-1 px-4 py-6 sm:px-6 sm:py-8 lg:px-10 lg:py-10">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
