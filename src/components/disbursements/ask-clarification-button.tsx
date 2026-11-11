"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MessageCircleQuestion } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * AskClarificationButton (spec §6 Step 7, ADR-0019): the coordinator asks
 * the beneficiary one clarification question. The latest unanswered
 * question is shown in the beneficiary portal.
 */
export function AskClarificationButton({ disbursementId }: { disbursementId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  async function ask() {
    setState("sending");
    setError(null);
    try {
      const res = await fetch(`/api/disbursements/${disbursementId}/clarification`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not ask the question.");
      setOpen(false);
      setQuestion("");
      setState("idle");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not ask the question.");
      setState("error");
    }
  }

  if (!open) {
    return (
      <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)} className="w-full">
        <MessageCircleQuestion className="h-4 w-4" /> Ask a clarification
      </Button>
    );
  }

  return (
    <div className="space-y-2 rounded-2xl border border-slate-200 bg-slate-50/60 p-3">
      <textarea
        value={question}
        onChange={(e) => setQuestion(e.target.value)}
        rows={3}
        maxLength={2000}
        placeholder="e.g. Could you tell us more about the transport costs?"
        aria-label="Clarification question"
        className="w-full resize-y rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
      />
      <div className="flex gap-2">
        <Button type="button" variant="outline" size="sm" onClick={() => setOpen(false)}>
          Cancel
        </Button>
        <Button
          type="button"
          size="sm"
          onClick={ask}
          disabled={question.trim() === "" || state === "sending"}
        >
          {state === "sending" ? "Sending…" : "Send question"}
        </Button>
      </div>
      {error ? <p className="text-xs text-rose-600">{error}</p> : null}
    </div>
  );
}
