/**
 * Slice 2.3 acceptance tests (use case): parseSupportIntent(note,
 * amountMinor, currency) returns the schema-validated plan, applying
 * only deterministic rules (over-total → clarification). The AI
 * provider is mocked — no network.
 */
import { describe, expect, it } from "vitest";
import { ParseSupportIntent } from "./parse-support-intent";
import type { AiProvider, ExtractedPlan } from "@/application/ports/ai";

const AMOUNT_MINOR = 50000n; // $500.00

function stubProvider(plan: ExtractedPlan): AiProvider {
  return {
    ping: async () => ({ provider: "openai", model: "test-model" }),
    parseIntent: async () => plan,
    explainDiff: async () => ({ explanation: "unused" }),
  };
}

const EXPLICIT_PLAN: ExtractedPlan = {
  summary: "Proposed family support allocation",
  items: [
    { category: "Rent", amountText: "300.00", evidenceText: "$300 for rent", confidence: 0.99 },
    { category: "School fees", amountText: "150.00", evidenceText: "$150 for school fees", confidence: 0.99 },
    { category: "Food", amountText: "50.00", evidenceText: "$50 for food", confidence: 0.99 },
  ],
  requiresClarification: false,
  clarificationQuestion: null,
};

describe("ParseSupportIntent (Slice 2.3)", () => {
  it("extracts explicit amounts from the note", async () => {
    const useCase = new ParseSupportIntent(stubProvider(EXPLICIT_PLAN));
    const result = await useCase.execute({ note: "Rent $300, school $150, food $50", amountMinor: AMOUNT_MINOR, currency: "USD" });
    expect(result.items.map((i) => i.amountText)).toEqual(["300.00", "150.00", "50.00"]);
    expect(result.requiresClarification).toBe(false);
  });

  it("returns null for a missing amount (never invented)", async () => {
    const plan: ExtractedPlan = {
      ...EXPLICIT_PLAN,
      items: [{ category: "Miscellaneous", amountText: null, evidenceText: "miscellaneous expenses", confidence: 0.5 }],
      requiresClarification: true,
      clarificationQuestion: "How much is the miscellaneous amount?",
    };
    const useCase = new ParseSupportIntent(stubProvider(plan));
    const result = await useCase.execute({ note: "miscellaneous expenses", amountMinor: AMOUNT_MINOR, currency: "USD" });
    expect(result.items[0]!.amountText).toBeNull();
  });

  it("does not split an unspecified amount evenly", async () => {
    const plan: ExtractedPlan = {
      ...EXPLICIT_PLAN,
      items: [
        { category: "Rent", amountText: "200.00", evidenceText: "$200 for rent", confidence: 0.9 },
        { category: "Food", amountText: null, evidenceText: "food", confidence: 0.4 },
      ],
    };
    const useCase = new ParseSupportIntent(stubProvider(plan));
    const result = await useCase.execute({ note: "$200 for rent and food", amountMinor: AMOUNT_MINOR, currency: "USD" });
    expect(result.items.find((i) => i.category === "Food")!.amountText).toBeNull();
    expect(result.items.find((i) => i.category === "Rent")!.amountText).toBe("200.00");
  });

  it("flags over-total allocations for clarification", async () => {
    const plan: ExtractedPlan = {
      ...EXPLICIT_PLAN,
      items: [
        { category: "Rent", amountText: "400.00", evidenceText: "$400 for rent", confidence: 0.9 },
        { category: "Food", amountText: "200.00", evidenceText: "$200 for food", confidence: 0.9 },
      ],
      requiresClarification: false,
      clarificationQuestion: null,
    };
    const useCase = new ParseSupportIntent(stubProvider(plan));
    const result = await useCase.execute({ note: "$400 rent, $200 food", amountMinor: AMOUNT_MINOR, currency: "USD" });
    expect(result.requiresClarification).toBe(true);
  });

  it("returns empty items with clarification for vague notes", async () => {
    const plan: ExtractedPlan = {
      summary: "No explicit amounts found",
      items: [],
      requiresClarification: true,
      clarificationQuestion: "Please give amounts for each category.",
    };
    const useCase = new ParseSupportIntent(stubProvider(plan));
    const result = await useCase.execute({ note: "help with everything", amountMinor: AMOUNT_MINOR, currency: "USD" });
    expect(result.items).toEqual([]);
    expect(result.requiresClarification).toBe(true);
  });

  it("preserves source evidenceText for each item", async () => {
    const useCase = new ParseSupportIntent(stubProvider(EXPLICIT_PLAN));
    const result = await useCase.execute({ note: "Rent $300, school $150, food $50", amountMinor: AMOUNT_MINOR, currency: "USD" });
    expect(result.items.map((i) => i.evidenceText)).toEqual([
      "$300 for rent",
      "$150 for school fees",
      "$50 for food",
    ]);
  });
});
