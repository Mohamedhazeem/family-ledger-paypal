"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

/**
 * AcknowledgeButton (Slice 3.7): records the coordinator's
 * acknowledgement of the plan (spec §6 Step 7).
 */
export function AcknowledgeButton({ disbursementId }: { disbursementId: string }) {
  const router = useRouter();
  const [state, setState] = useState<"idle" | "sending" | "done" | "error">("idle");

  async function acknowledge() {
    setState("sending");
    try {
      const res = await fetch(`/api/disbursements/${disbursementId}/acknowledge`, { method: "POST" });
      if (!res.ok) throw new Error("failed");
      setState("done");
      router.refresh();
    } catch {
      setState("error");
    }
  }

  if (state === "done") {
    return (
      <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
        Acknowledged. The plan is now mutually acknowledged.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <Button onClick={acknowledge} disabled={state === "sending"} className="w-full">
        {state === "sending" ? "Recording…" : "Acknowledge plan"}
      </Button>
      {state === "error" ? (
        <p className="text-sm text-rose-600">Something went wrong. Please try again.</p>
      ) : null}
    </div>
  );
}
