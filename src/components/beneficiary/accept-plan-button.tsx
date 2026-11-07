"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

/**
 * AcceptPlanButton (Slice 3.3): submits the beneficiary's acceptance
 * with the invitation token and swaps to a confirmation on success.
 */
export function AcceptPlanButton({ token }: { token: string }) {
  const [state, setState] = useState<"idle" | "sending" | "done" | "error">("idle");

  async function accept() {
    setState("sending");
    try {
      const res = await fetch(`/api/beneficiary/${token}/accept`, { method: "POST" });
      if (!res.ok) throw new Error("failed");
      setState("done");
    } catch {
      setState("error");
    }
  }

  if (state === "done") {
    return (
      <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
        Thank you — your acceptance is recorded. Your coordinator will review the plan with you.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <Button onClick={accept} disabled={state === "sending"} className="w-full">
        {state === "sending" ? "Recording…" : "Accept this plan"}
      </Button>
      {state === "error" ? (
        <p className="text-sm text-rose-600">
          Something went wrong. Please try again or contact your coordinator.
        </p>
      ) : null}
    </div>
  );
}
