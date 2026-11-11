"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Link2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ShareLinkButtons } from "./share-link-buttons";

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

  if (link) {
    return (
      <div className="space-y-2 rounded-2xl border border-indigo-200 bg-indigo-50 p-3">
        <p className="text-xs font-medium uppercase tracking-wider text-indigo-700">
          Invitation link — shown only once
        </p>
        <ShareLinkButtons url={link.url} expiresAt={link.expiresAt} />
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
