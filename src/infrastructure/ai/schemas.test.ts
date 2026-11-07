/**
 * Slice 2.2 acceptance tests: the extraction schema must match the
 * spec §6 Step 2 output shape, reject unknown fields, and require
 * the amountText key (nullable, never silently invented).
 */
import { describe, expect, it } from "vitest";
import { ExtractedPlanSchema } from "./schemas";

const VALID_PLAN = {
  summary: "Proposed family support allocation",
  items: [
    { category: "Rent", amountText: "300.00", evidenceText: "$300 for rent", confidence: 0.99 },
    { category: "School fees", amountText: "150.00", evidenceText: "$150 for school fees", confidence: 0.99 },
    { category: "Food", amountText: "50.00", evidenceText: "$50 for food", confidence: 0.99 },
  ],
  requiresClarification: false,
  clarificationQuestion: null,
};

describe("ExtractedPlanSchema (Slice 2.2)", () => {
  it("accepts the spec §6 Step 2 example", () => {
    const result = ExtractedPlanSchema.safeParse(VALID_PLAN);
    expect(result.success).toBe(true);
  });

  it("rejects an unknown top-level field", () => {
    const result = ExtractedPlanSchema.safeParse({ ...VALID_PLAN, invented: true });
    expect(result.success).toBe(false);
  });

  it("rejects an unknown field inside an item", () => {
    const result = ExtractedPlanSchema.safeParse({
      ...VALID_PLAN,
      items: [{ ...VALID_PLAN.items[0], extra: "nope" }],
    });
    expect(result.success).toBe(false);
  });

  it("rejects an item missing the amountText key", () => {
    const itemWithoutAmount = {
      category: VALID_PLAN.items[0]!.category,
      evidenceText: VALID_PLAN.items[0]!.evidenceText,
      confidence: VALID_PLAN.items[0]!.confidence,
    };
    const result = ExtractedPlanSchema.safeParse({ ...VALID_PLAN, items: [itemWithoutAmount] });
    expect(result.success).toBe(false);
  });

  it("accepts amountText as null for a category with no explicit amount", () => {
    const result = ExtractedPlanSchema.safeParse({
      ...VALID_PLAN,
      items: [{ ...VALID_PLAN.items[0], amountText: null }],
      requiresClarification: true,
      clarificationQuestion: "How much is the rent?",
    });
    expect(result.success).toBe(true);
  });

  it("rejects a non-decimal amountText", () => {
    const result = ExtractedPlanSchema.safeParse({
      ...VALID_PLAN,
      items: [{ ...VALID_PLAN.items[0], amountText: "$300" }],
    });
    expect(result.success).toBe(false);
  });

  it("rejects a confidence outside 0-1", () => {
    const result = ExtractedPlanSchema.safeParse({
      ...VALID_PLAN,
      items: [{ ...VALID_PLAN.items[0], confidence: 1.5 }],
    });
    expect(result.success).toBe(false);
  });

  it("accepts an empty items array for vague notes", () => {
    const result = ExtractedPlanSchema.safeParse({
      summary: "No explicit amounts found",
      items: [],
      requiresClarification: true,
      clarificationQuestion: "Please give amounts for each category.",
    });
    expect(result.success).toBe(true);
  });
});
