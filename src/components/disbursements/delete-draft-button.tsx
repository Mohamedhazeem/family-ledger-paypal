"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * DeleteDraftButton (ADR-0018): soft-deletes a disbursement that was
 * never sent. Only rendered when paymentStatus === NOT_SENT. Two-step
 * confirm; on success the coordinator lands back on the register.
 */
export function DeleteDraftButton({ disbursementId }: { disbursementId: string }) {
  const router = useRouter();
  const [state, setState] = useState<"idle" | "confirm" | "error">("idle");
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function doDelete() {
    setDeleting(true);
    setError(null);
    try {
      const res = await fetch(`/api/disbursements/${disbursementId}`, { method: "DELETE" });
      const data = res.ok ? null : await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? "Could not delete the disbursement.");
      router.push("/disbursements");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not delete the disbursement.");
      setState("error");
      setDeleting(false);
    }
  }

  if (state === "confirm") {
    return (
      <div className="space-y-2 rounded-2xl border border-rose-200 bg-rose-50 p-3">
        <p className="text-sm text-rose-800">
          Delete this draft? The record is kept for audit, but it disappears from the register and
          its invitation links stop working.
        </p>
        <div className="flex gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => setState("idle")}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="danger"
            size="sm"
            onClick={doDelete}
            disabled={deleting}
          >
            <Trash2 className="h-4 w-4" />
            {deleting ? "Deleting…" : "Confirm delete"}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <Button type="button" variant="outline" size="sm" onClick={() => setState("confirm")}>
        <Trash2 className="h-4 w-4" /> Delete draft
      </Button>
      {error ? <p className="text-xs text-rose-600">{error}</p> : null}
    </div>
  );
}
