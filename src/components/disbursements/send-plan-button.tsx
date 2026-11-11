"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ShareLinkButtons } from "./share-link-buttons";

/**
 * SendPlanButton: the coordinator's explicit "send plan / proposal"
 * action. Mints a fresh invitation and emails the latest plan version to
 * the beneficiary. When no email provider is configured (or delivery
 * fails) the copyable link is surfaced as the fallback — the link is
 * always the source of truth (spec §6 Step 4).
 */
export function SendPlanButton({
  disbursementId,
  beneficiaryEmail,
}: {
  disbursementId: string;
  beneficiaryEmail: string;
}) {
  const router = useRouter();
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [link, setLink] = useState<{ url: string; expiresAt: string } | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function send() {
    setState("sending");
    setMessage(null);
    try {
      const res = await fetch(`/api/disbursements/${disbursementId}/send-plan`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not send the plan.");
      setLink({ url: data.url, expiresAt: data.expiresAt });
      setMessage(
        data.delivered
          ? `Sent to ${beneficiaryEmail} via ${data.provider}.`
          : "Email not configured — copy the link to share it manually.",
      );
      setState("sent");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not send the plan.");
      setState("error");
    }
  }

  if (state === "sent" && link) {
    return (
      <div className="space-y-2 rounded-2xl border border-emerald-200 bg-emerald-50 p-3">
        <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-emerald-700">
          <CheckCircle2 className="h-4 w-4" /> Plan sent
        </p>
        <p className="text-sm text-emerald-800">{message}</p>
        <ShareLinkButtons url={link.url} expiresAt={link.expiresAt} />
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <Button type="button" onClick={send} disabled={state === "sending"} className="w-full">
        <Send className="h-4 w-4" />
        {state === "sending" ? "Sending…" : "Send plan to beneficiary"}
      </Button>
      {message ? <p className="text-xs text-rose-600">{message}</p> : null}
    </div>
  );
}
