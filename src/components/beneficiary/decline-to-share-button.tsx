"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

/**
 * DeclineToShareButton (Slice 3.5): records the beneficiary's choice
 * not to share an allocation plan. Payment is unaffected (spec §4.5).
 */
export function DeclineToShareButton({ token }: { token: string }) {
  const [state, setState] = useState<"idle" | "sending" | "done" | "error">("idle");

  async function decline() {
    setState("sending");
    try {
      const res = await fetch(`/api/beneficiary/${token}/decline`, { method: "POST" });
      if (!res.ok) throw new Error("failed");
      setState("done");
    } catch {
      setState("error");
    }
  }

  if (state === "done") {
    return (
      <p className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700">
        Noted — you do not need to share a plan. Your support payment is unaffected.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <Button
        type="button"
        variant="outline"
        onClick={decline}
        disabled={state === "sending"}
        className="w-full"
      >
        {state === "sending" ? "Recording…" : "I prefer not to share a plan"}
      </Button>
      {state === "error" ? (
        <p className="text-sm text-rose-600">
          Something went wrong. Please try again or contact your coordinator.
        </p>
      ) : null}
    </div>
  );
}
