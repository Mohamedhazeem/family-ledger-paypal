"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

/**
 * RefreshPayoutStatusButton (Slice 4.7): explicit manual refresh of
 * the sandbox payout statuses. No auto-polling, no webhook UI.
 */
export function RefreshPayoutStatusButton({ disbursementId }: { disbursementId: string }) {
  const router = useRouter();
  const [state, setState] = useState<"idle" | "sending" | "done" | "error">("idle");

  async function refresh() {
    setState("sending");
    try {
      const res = await fetch(`/api/disbursements/${disbursementId}/payout-status`);
      if (!res.ok) throw new Error("failed");
      setState("done");
      router.refresh();
    } catch {
      setState("error");
    }
  }

  return (
    <div className="space-y-2">
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={refresh}
        disabled={state === "sending"}
      >
        {state === "sending" ? "Refreshing…" : "Refresh status"}
      </Button>
      {state === "error" ? (
        <p className="text-xs text-rose-600">Could not refresh the payout status.</p>
      ) : null}
    </div>
  );
}
