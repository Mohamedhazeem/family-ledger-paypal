/**
 * Slice 3.6: ExplainPlanDiff use case (spec §12B). The AI receives
 * only the computed diff and explains it; unchanged diffs never
 * reach the model; AI failure falls back to a deterministic
 * template. The provider is stubbed — no network.
 */
import { describe, expect, it } from "vitest";
import { diffPlans } from "@/domain/plan-diff";
import { ExplainPlanDiff } from "./explain-plan-diff";
import type { AiProvider } from "@/application/ports/ai";

function stubProvider(fail = false): { provider: AiProvider; calls: () => number } {
  let count = 0;
  const provider: AiProvider = {
    ping: async () => ({ provider: "openai", model: "test-model" }),
    parseIntent: async () => { throw new Error("unused"); },
    explainDiff: async () => {
      count += 1;
      if (fail) throw new Error("model unavailable");
      return { explanation: "The plan adds a medicine allowance." };
    },
    translate: async (input) => ({ translatedText: input.text }),
  };
  return { provider, calls: () => count };
}

describe("ExplainPlanDiff (Slice 3.6)", () => {
  it("returns the AI explanation for a real diff", async () => {
    const stub = stubProvider();
    const useCase = new ExplainPlanDiff(stub.provider);
    const diff = diffPlans(
      { items: [{ category: "Food", amountMinor: 5000n }] },
      { items: [
        { category: "Food", amountMinor: 5000n },
        { category: "Medicine", amountMinor: 5000n },
      ] },
    );
    const result = await useCase.execute(diff);
    expect(result.explanation).toBe("The plan adds a medicine allowance.");
    expect(result.source).toBe("ai");
    expect(stub.calls()).toBe(1);
  });

  it("never calls the AI when the plan is unchanged", async () => {
    const stub = stubProvider();
    const useCase = new ExplainPlanDiff(stub.provider);
    const diff = diffPlans(
      { items: [{ category: "Rent", amountMinor: 30000n }] },
      { items: [{ category: "Rent", amountMinor: 30000n }] },
    );
    const result = await useCase.execute(diff);
    expect(result.explanation).toContain("No changes");
    expect(result.source).toBe("template");
    expect(stub.calls()).toBe(0);
  });

  it("falls back to a deterministic template when the AI fails", async () => {
    const stub = stubProvider(true);
    const useCase = new ExplainPlanDiff(stub.provider);
    const diff = diffPlans(
      { items: [{ category: "Food", amountMinor: 5000n }] },
      { items: [{ category: "Food", amountMinor: 7500n }] },
    );
    const result = await useCase.execute(diff);
    expect(result.explanation).toContain("+$25.00");
    expect(result.source).toBe("template");
  });
});
