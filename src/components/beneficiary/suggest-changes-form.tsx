"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { PlanItemsEditor, type PlanItemDraft } from "@/components/disbursements/plan-items-editor";
import { decimalToMinor } from "@/components/disbursements/money-client";

/**
 * SuggestChangesForm (Slice 3.4): the beneficiary edits categories /
 * amounts and optionally explains them; the submission creates a new
 * immutable PlanVersion (spec §6 Step 5). Reuses the coordinator's
 * PlanItemsEditor (totals + over-total guard are shared).
 */
export function SuggestChangesForm({
  token,
  initialItems,
  totalMinor,
  submitLabel,
}: {
  token: string;
  initialItems: PlanItemDraft[];
  totalMinor: number;
  submitLabel: string;
}) {
  const [items, setItems] = useState<PlanItemDraft[]>(initialItems);
  const [explanation, setExplanation] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "done" | "error">("idle");

  const allocated = items.reduce((sum, item) => sum + (decimalToMinor(item.amountText) ?? 0), 0);
  const overTotal = allocated > totalMinor;
  const itemsInvalid = items.some(
    (item) => item.amountText.trim() !== "" && decimalToMinor(item.amountText) === null,
  );
  const canSubmit = !overTotal && !itemsInvalid && items.some((item) => item.category.trim() !== "");

  async function submit() {
    setState("sending");
    try {
      const planItems = items
        .filter((item) => item.category.trim() !== "" || item.amountText.trim() !== "")
        .map((item) => ({
          category: item.category.trim(),
          amountText: item.amountText.trim() === "" ? null : item.amountText.trim(),
        }));
      const res = await fetch(`/api/beneficiary/${token}/suggest`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: planItems,
          explanation: explanation.trim() === "" ? null : explanation.trim(),
        }),
      });
      if (!res.ok) throw new Error("failed");
      setState("done");
    } catch {
      setState("error");
    }
  }

  if (state === "done") {
    return (
      <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
        Thank you — your suggestions are recorded. Your coordinator will review them with you.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <PlanItemsEditor items={items} totalMinor={totalMinor} onChange={setItems} />
      <label className="block space-y-1.5">
        <span className="text-sm font-medium text-slate-700">Explain your changes (optional)</span>
        <textarea
          value={explanation}
          onChange={(e) => setExplanation(e.target.value)}
          rows={2}
          maxLength={2000}
          placeholder="e.g. School starts next month"
          className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
        />
      </label>
      <Button onClick={submit} disabled={!canSubmit || state === "sending"} className="w-full">
        {state === "sending" ? "Sending…" : submitLabel}
      </Button>
      {state === "error" ? (
        <p className="text-sm text-rose-600">
          Something went wrong. Please try again or contact your coordinator.
        </p>
      ) : null}
    </div>
  );
}
