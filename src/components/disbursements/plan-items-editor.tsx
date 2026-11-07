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
      if (minor === null) {
        invalid = true;
      } else {
        allocated += minor;
      }
    }
    return { allocated, invalid };
  }, [items]);

  function update(index: number, patch: Partial<PlanItemDraft>) {
    onChange(items.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  }

  const over = totalMinor !== null && sums.allocated > totalMinor;
  const remainder = totalMinor !== null ? totalMinor - sums.allocated : null;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-900">Allocation plan</h3>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => onChange([...items, { category: "", amountText: "" }])}
        >
          <Plus className="h-4 w-4" /> Add category
        </Button>
      </div>

      {items.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-300 px-4 py-6 text-center text-sm text-slate-500">
          No plan yet. Write the support intention above and click “Extract plan”, or add a category.
        </p>
      ) : (
        <div className="space-y-2">
          {items.map((item, index) => (
            <div key={index} className="flex items-end gap-2">
              <label className="block flex-1 space-y-1.5">
                <span className="text-xs font-medium text-slate-600">Category {index + 1}</span>
                <Input
                  value={item.category}
                  onChange={(e) => update(index, { category: e.target.value })}
                  placeholder="Rent"
                  aria-label={`Category ${index + 1}`}
                />
              </label>
              <label className="block w-36 space-y-1.5">
                <span className="text-xs font-medium text-slate-600">Amount (USD)</span>
                <Input
                  value={item.amountText}
                  onChange={(e) => update(index, { amountText: e.target.value })}
                  placeholder="300.00"
                  inputMode="decimal"
                  aria-label={`Amount for category ${index + 1}`}
                />
              </label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                aria-label={`Remove category ${index + 1}`}
                onClick={() => onChange(items.filter((_, i) => i !== index))}
              >
                <Trash2 className="h-4 w-4 text-rose-500" />
              </Button>
            </div>
          ))}
        </div>
      )}

      <div className="rounded-xl bg-slate-50 px-4 py-3 text-sm">
        <div className="flex justify-between py-0.5">
          <span className="text-slate-500">Allocated</span>
          <span className="font-semibold tabular-nums text-slate-900">
            ${minorToDecimal(sums.allocated)}
          </span>
        </div>
        <div className="flex justify-between py-0.5">
          <span className="text-slate-500">Disbursement total</span>
          <span className="font-semibold tabular-nums text-slate-900">
            {totalMinor === null ? "—" : `$${minorToDecimal(totalMinor)}`}
          </span>
        </div>
        {remainder !== null && !over ? (
          <div className="flex justify-between py-0.5">
            <span className="text-slate-500">Unallocated remainder</span>
            <span className="font-semibold tabular-nums text-slate-900">
              ${minorToDecimal(remainder)}
            </span>
          </div>
        ) : null}
      </div>

      {sums.invalid ? (
        <p className="text-sm text-rose-600">Every amount must be a valid decimal (e.g. 300.00).</p>
      ) : null}
      {over ? (
        <p className="text-sm font-medium text-rose-600">
          Allocations exceed the disbursement total. Adjust before saving.
        </p>
      ) : null}
      {remainder !== null && remainder > 0 && !over ? (
        <p className="text-xs text-slate-500">
          The remainder stays flexible/unallocated until the coordinator confirms it.
        </p>
      ) : null}
    </div>
  );
}
