"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PencilLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PlanItemsEditor, type PlanItemDraft } from "./plan-items-editor";
import { decimalToMinor, isValidDecimalText } from "./money-client";

/**
 * AdjustProposalButton (ADR-0019): the coordinator edits the full amount
 * and/or the categories after a beneficiary suggestion. Saving appends a
 * new immutable PlanVersion; the beneficiary's version stays in history.
 * Guarded to NOT_SENT disbursements by the route/use case.
 */
export function AdjustProposalButton({
  disbursementId,
  initialItems,
  initialTotalText,
}: {
  disbursementId: string;
  initialItems: PlanItemDraft[];
  initialTotalText: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<PlanItemDraft[]>(initialItems);
  const [totalText, setTotalText] = useState(initialTotalText);
  const [state, setState] = useState<"idle" | "saving" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  const totalMinor = decimalToMinor(totalText);
  const allocated = items.reduce((sum, item) => sum + (decimalToMinor(item.amountText) ?? 0), 0);
  const overTotal = totalMinor !== null && allocated > totalMinor;
  const totalInvalid = !isValidDecimalText(totalText) || (totalMinor ?? 0) <= 0;
  const itemsInvalid = items.some(
    (item) => item.amountText.trim() !== "" && decimalToMinor(item.amountText) === null,
  );
  const canSave =
    !overTotal && !totalInvalid && !itemsInvalid && items.some((item) => item.category.trim() !== "");

  async function save() {
    setState("saving");
    setError(null);
    try {
      const planItems = items
        .filter((item) => item.category.trim() !== "" || item.amountText.trim() !== "")
        .map((item) => ({
          category: item.category.trim(),
          amountText: item.amountText.trim() === "" ? null : item.amountText.trim(),
        }));
      const res = await fetch(`/api/disbursements/${disbursementId}/revise`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ totalText: totalText.trim(), items: planItems }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not save the proposal.");
      setOpen(false);
      setState("idle");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save the proposal.");
      setState("error");
    }
  }

  if (!open) {
    return (
      <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)} className="w-full">
        <PencilLine className="h-4 w-4" /> Adjust proposal
      </Button>
    );
  }

  return (
    <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50/60 p-3">
      <label className="block space-y-1.5">
        <span className="text-xs font-medium text-slate-600">Full support amount (USD)</span>
        <Input
          value={totalText}
          onChange={(e) => setTotalText(e.target.value)}
          inputMode="decimal"
          aria-label="Full support amount"
        />
      </label>
      <PlanItemsEditor items={items} totalMinor={totalMinor} onChange={setItems} />
      <div className="flex gap-2">
        <Button type="button" variant="outline" size="sm" onClick={() => setOpen(false)}>
          Cancel
        </Button>
        <Button type="button" size="sm" onClick={save} disabled={!canSave || state === "saving"}>
          {state === "saving" ? "Saving…" : "Save as new version"}
        </Button>
      </div>
      {error ? <p className="text-xs text-rose-600">{error}</p> : null}
    </div>
  );
}
