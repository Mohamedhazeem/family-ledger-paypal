"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

interface DiffWireEntry {
  category: string;
  v1AmountMinor: string | null;
  v2AmountMinor: string | null;
  deltaMinor: string | null;
}

interface DiffWire {
  added: DiffWireEntry[];
  removed: DiffWireEntry[];
  changed: DiffWireEntry[];
  unchanged: DiffWireEntry[];
}

/**
 * ExplainDiffButton (Slice 3.7): asks the AI to explain the
 * deterministic diff (spec §12B). The diff travels over the wire as
 * string-encoded minor units (JSON-safe).
 */
export function ExplainDiffButton({ diff }: { diff: DiffWire }) {
  const [state, setState] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [explanation, setExplanation] = useState<string | null>(null);

  async function explain() {
    setState("sending");
    try {
      const res = await fetch("/api/ai/compare-plans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(diff),
      });
      const data = await res.json();
      if (!res.ok) throw new Error("failed");
      setExplanation(data.explanation);
      setState("done");
    } catch {
      setState("error");
    }
  }

  if (state === "done" && explanation) {
    return (
      <div className="rounded-xl bg-slate-50 px-4 py-3">
        <p className="text-sm text-slate-700">{explanation}</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <Button type="button" variant="outline" onClick={explain} disabled={state === "sending"}>
        {state === "sending" ? "Explaining…" : "Explain with AI"}
      </Button>
      {state === "error" ? (
        <p className="text-sm text-rose-600">
          Could not generate an explanation. The diff above is still accurate.
        </p>
      ) : null}
    </div>
  );
}
