/**
 * Slice 3.6: deterministic plan diff (spec §6 Step 6, §12B, domain).
 * The AI only explains the computed diff; no AI is involved here.
 */
import { describe, expect, it } from "vitest";
import { diffPlans, type PlanVersionSnapshot } from "@/domain/plan-diff";

function v(items: { category: string; amountMinor: bigint | null }[]): PlanVersionSnapshot {
  return { items };
}

describe("diffPlans (Slice 3.6)", () => {
  it("reports added categories", () => {
    const diff = diffPlans(
      v([{ category: "Rent", amountMinor: 30000n }]),
      v([
        { category: "Rent", amountMinor: 30000n },
        { category: "Medicine", amountMinor: 5000n },
      ]),
    );
    expect(diff.added).toEqual([
      { category: "Medicine", v1AmountMinor: null, v2AmountMinor: 5000n, deltaMinor: 5000n },
    ]);
    expect(diff.removed).toEqual([]);
    expect(diff.changed).toEqual([]);
    expect(diff.unchanged).toEqual([
      { category: "Rent", v1AmountMinor: 30000n, v2AmountMinor: 30000n, deltaMinor: 0n },
    ]);
  });

  it("reports removed categories with a negative delta", () => {
    const diff = diffPlans(
      v([
        { category: "Rent", amountMinor: 30000n },
        { category: "Food", amountMinor: 15000n },
      ]),
      v([{ category: "Rent", amountMinor: 30000n }]),
    );
    expect(diff.removed).toEqual([
      { category: "Food", v1AmountMinor: 15000n, v2AmountMinor: null, deltaMinor: -15000n },
    ]);
  });

  it("reports changed categories with the exact minor-unit delta", () => {
    const diff = diffPlans(
      v([{ category: "Food", amountMinor: 5000n }]),
      v([{ category: "Food", amountMinor: 7500n }]),
    );
    expect(diff.changed).toEqual([
      { category: "Food", v1AmountMinor: 5000n, v2AmountMinor: 7500n, deltaMinor: 2500n },
    ]);
  });
});
