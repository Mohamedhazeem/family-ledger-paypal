"use client";

import { useMemo, type Dispatch, type SetStateAction } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { decimalToMinor, minorToDecimal } from "./money-client";

export interface PlanItemDraft {
  category: string;
  amountText: string;
}

interface PlanItemsEditorProps {
  items: PlanItemDraft[];
  totalMinor: number | null;
  onChange: Dispatch<SetStateAction<PlanItemDraft[]>>;
}

export function PlanItemsEditor({ items, totalMinor, onChange }: PlanItemsEditorProps) {
  const sums = useMemo(() => {
    let allocated = 0;
    let invalid = false;
    for (const item of items) {
      if (item.amountText.trim() === "") continue;
      const minor = decimalToMinor(item.amountText);
      if (minor === null) invalid = true;
      else allocated += minor;
    }
    return { allocated, invalid };
  }, [items]);

  function update(index: number, patch: Partial<PlanItemDraft>) {
    onChange(items.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  }

  const over = totalMinor !== null && sums.allocated > totalMinor;
  const remainder = totalMinor !== null ? totalMinor - sums.allocated : null;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">Allocation categories</h3>
          <p className="text-xs text-slate-500">Leave an amount blank to keep it flexible.</p>
        </div>
        <Button type="button" variant="outline" size="sm" className="rounded-full" onClick={() => onChange([...items, { category: "", amountText: "" }])}>
          <Plus className="h-4 w-4" /> Add category
        </Button>
      </div>

      {items.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50/70 px-5 py-8 text-center">
          <p className="font-medium text-slate-700">No plan yet</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-slate-500">Write the support intention and choose Extract plan, or add a category manually.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item, index) => (
            <div key={index} className="grid grid-cols-1 gap-3 rounded-2xl border border-slate-200 bg-slate-50/60 p-3 sm:grid-cols-[minmax(0,1fr)_150px_auto] sm:items-end">
              <label className="block space-y-1.5">
                <span className="text-xs font-medium text-slate-600">Category {index + 1}</span>
                <Input value={item.category} onChange={(e) => update(index, { category: e.target.value })} placeholder="Rent" aria-label={`Category ${index + 1}`} />
              </label>
              <label className="block space-y-1.5">
                <span className="text-xs font-medium text-slate-600">Amount (USD)</span>
                <Input value={item.amountText} onChange={(e) => update(index, { amountText: e.target.value })} placeholder="300.00" inputMode="decimal" aria-label={`Amount for category ${index + 1}`} />
              </label>
              <Button type="button" variant="ghost" size="sm" aria-label={`Remove category ${index + 1}`} onClick={() => onChange(items.filter((_, i) => i !== index))} className="justify-self-end rounded-full hover:bg-rose-50">
                <Trash2 className="h-4 w-4 text-rose-500" />
              </Button>
            </div>
          ))}
        </div>
      )}

      <div className="grid gap-3 rounded-2xl bg-slate-950 px-4 py-3 text-sm text-white sm:grid-cols-3">
        <div><p className="text-slate-400">Allocated</p><p className="font-semibold tabular-nums">${minorToDecimal(sums.allocated)}</p></div>
        <div><p className="text-slate-400">Total</p><p className="font-semibold tabular-nums">{totalMinor === null ? "—" : `$${minorToDecimal(totalMinor)}`}</p></div>
        <div><p className="text-slate-400">Flexible remainder</p><p className="font-semibold tabular-nums">{remainder === null || over ? "—" : `$${minorToDecimal(remainder)}`}</p></div>
      </div>

      {sums.invalid ? <p className="text-sm text-rose-600">Every amount must be a valid decimal (e.g. 300.00).</p> : null}
      {over ? <p className="text-sm font-medium text-rose-600">Allocations exceed the disbursement total. Adjust before saving.</p> : null}
      {remainder !== null && remainder > 0 && !over ? <p className="text-xs text-slate-500">The remainder stays flexible/unallocated until the coordinator confirms it.</p> : null}
    </div>
  );
}
