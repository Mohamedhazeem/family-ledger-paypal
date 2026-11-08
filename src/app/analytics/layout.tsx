import React from "react";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { DashboardShell } from "@/components/layout/dashboard-shell";

export default async function AnalyticsLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login");
  return (
    <DashboardShell user={{ name: session.user.name, email: session.user.email }}>
      {children}
    </DashboardShell>
  );
}
