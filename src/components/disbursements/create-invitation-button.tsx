"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, Link2 } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * CreateInvitationButton (Slice 3.1): mints a new invitation from the
 * detail page and shows the portal link exactly once — the plaintext
 * token is never stored server-side, so it cannot be looked up later.
 * Creating supersedes (revokes) the disbursement's other active links.
 */
export function CreateInvitationButton({ disbursementId }: { disbursementId: string }) {
  const router = useRouter();
  const [state, setState] = useState<"idle" | "sending" | "error">("idle");
  const [link, setLink] = useState<{ url: string; expiresAt: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function create() {
    setState("sending");
    setError(null);
    try {
      const res = await fetch(`/api/disbursements/${disbursementId}/invitations`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not create the invitation.");
      setLink({ url: data.url, expiresAt: data.expiresAt });
      setState("idle");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create the invitation.");
      setState("error");
    }
  }

  async function copy() {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link.url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard unavailable (e.g. insecure context) — the link stays
      // visible so the coordinator can copy it manually.
    }
  }

  if (link) {
    return (
      <div className="space-y-2 rounded-2xl border border-indigo-200 bg-indigo-50 p-3">
        <p className="text-xs font-medium uppercase tracking-wider text-indigo-700">
          Invitation link — shown only once
        </p>
        <p className="break-all rounded-xl border border-indigo-200 bg-white px-3 py-2 font-mono text-xs text-slate-700">
          {link.url}
        </p>
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs text-slate-500">
            Expires {new Date(link.expiresAt).toLocaleDateString()} · share it with the beneficiary
          </p>
          <Button type="button" variant="outline" size="sm" onClick={copy}>
            {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
            {copied ? "Copied" : "Copy link"}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <Button type="button" variant="outline" size="sm" onClick={create} disabled={state === "sending"}>
        <Link2 className="h-4 w-4" />
        {state === "sending" ? "Creating…" : "Create invitation link"}
      </Button>
      {error ? <p className="text-sm text-rose-600">{error}</p> : null}
    </div>
  );
}
