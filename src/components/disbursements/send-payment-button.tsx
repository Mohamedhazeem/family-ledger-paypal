"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

/**
 * SendPaymentButton (Slice 4.3, spec §6 Step 8): the coordinator's
 * explicit confirmation action. One sandbox payout for the full
 * disbursement; never gated on acknowledgement (spec §4.4).
 */
export function SendPaymentButton({ disbursementId }: { disbursementId: string }) {
  const router = useRouter();
  const [state, setState] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);

  async function send() {
    setState("sending");
    try {
      const res = await fetch(`/api/disbursements/${disbursementId}/pay`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "failed");
      setMessage(
        data.paypalPayoutBatchId
          ? `Submitted — PayPal batch ${data.paypalPayoutBatchId} (${data.paymentStatus}).`
          : `Not submitted (${data.paymentStatus}). Check payment status.`,
      );
      setState("done");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not submit the payout.");
      setState("error");
    }
  }

  return (
    <div className="space-y-2">
      <Button
        type="button"
        variant="secondary"
        onClick={send}
        disabled={state === "sending" || state === "done"}
        className="w-full"
      >
        {state === "sending" ? "Sending…" : "Send full payment"}
      </Button>
      {message ? (
        <p className={`text-xs ${state === "error" ? "text-rose-600" : "text-slate-500"}`}>{message}</p>
      ) : null}
    </div>
  );
}
