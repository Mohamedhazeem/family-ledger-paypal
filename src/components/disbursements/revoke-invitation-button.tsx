"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

/**
 * RevokeInvitationButton (Slice 3.11): revokes an active invitation.
 * Already-revoked invitations render as a status, not a button.
 */
export function RevokeInvitationButton({
  disbursementId,
  invitationId,
}: {
  disbursementId: string;
  invitationId: string;
}) {
  const router = useRouter();
  const [state, setState] = useState<"idle" | "sending" | "done" | "error">("idle");

  async function revoke() {
    setState("sending");
    try {
      const res = await fetch(
        `/api/disbursements/${disbursementId}/invitations/${invitationId}/revoke`,
        { method: "POST" },
      );
      if (!res.ok) throw new Error("failed");
      setState("done");
      router.refresh();
    } catch {
      setState("error");
    }
  }

  if (state === "done") {
    return <span className="text-sm font-medium text-emerald-600">Revoked</span>;
  }

  return (
    <span className="space-x-2">
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={revoke}
        disabled={state === "sending"}
      >
        {state === "sending" ? "Revoking…" : "Revoke"}
      </Button>
      {state === "error" ? (
        <span className="text-sm text-rose-600">Could not revoke.</span>
      ) : null}
    </span>
  );
}
