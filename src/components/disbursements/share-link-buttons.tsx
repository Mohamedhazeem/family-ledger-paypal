"use client";

import { useState } from "react";
import { Check, Copy, Mail, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * ShareLinkButtons: the copyable invitation link plus the coordinator's
 * own-channel fallbacks (mailto and WhatsApp share link). Used by both
 * the invitation-link card and the send-plan confirmation so the two
 * surfaces stay identical.
 */
export function ShareLinkButtons({ url, expiresAt }: { url: string; expiresAt: string }) {
  const [copied, setCopied] = useState(false);
  const expiry = new Date(expiresAt).toLocaleDateString();

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard unavailable (e.g. insecure context) — the link stays
      // visible so the coordinator can copy it manually.
    }
  }

  const mailto = `mailto:?subject=${encodeURIComponent(
    "Your family support plan",
  )}&body=${encodeURIComponent(
    `Here is your secure FamilyLedger invitation link (valid until ${expiry}):\n\n${url}\n\nThis is a voluntary support plan. It does not restrict how you use the money you receive.`,
  )}`;
  const whatsapp = `https://wa.me/?text=${encodeURIComponent(
    `Your FamilyLedger invitation link (valid until ${expiry}): ${url}`,
  )}`;

  return (
    <div className="space-y-2">
      <p className="break-all rounded-xl border border-indigo-200 bg-white px-3 py-2 font-mono text-xs text-slate-700">
        {url}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="outline" size="sm" onClick={copy}>
          {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
          {copied ? "Copied" : "Copy link"}
        </Button>
        <a
          href={mailto}
          className="inline-flex items-center gap-1.5 rounded-xl border border-indigo-200 bg-white px-3 py-1.5 text-xs font-medium text-indigo-700 transition hover:bg-indigo-50"
        >
          <Mail className="h-3.5 w-3.5" /> Email link
        </a>
        <a
          href={whatsapp}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 rounded-xl border border-indigo-200 bg-white px-3 py-1.5 text-xs font-medium text-indigo-700 transition hover:bg-indigo-50"
        >
          <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
        </a>
      </div>
    </div>
  );
}
