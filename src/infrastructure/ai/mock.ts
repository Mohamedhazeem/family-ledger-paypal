import "server-only";
import type {
  AiPingResult,
  AiProvider,
  ExplainDiffResult,
  ExtractedPlan,
  ParseIntentInput,
  TranslateInput,
  TranslateResult,
} from "@/application/ports/ai";
import type { PlanDiff } from "@/domain/plan-diff";

/**
 * Mock AI adapter (ADR-0016): deterministic, offline fallback for
 * tests and demo-lab runs without a provider key. It never invents
 * amounts — parseIntent asks for clarification by default, explainDiff
 * returns the deterministic template, and translate passes text
 * through unchanged.
 */
export class MockAiAdapter implements AiProvider {
  async ping(): Promise<AiPingResult> {
    return { provider: "mock", model: "mock-v1" };
  }

  async parseIntent(input: ParseIntentInput): Promise<ExtractedPlan> {
    return {
      summary: `Mock plan draft for USD ${input.amountMinor.toString()} minor units`,
      items: [],
      requiresClarification: true,
      clarificationQuestion:
        "Mock AI provider: no extraction performed. Add categories manually.",
    };
  }

  async explainDiff(diff: PlanDiff): Promise<ExplainDiffResult> {
    const added = diff.added.length;
    const removed = diff.removed.length;
    const changed = diff.changed.length;
    return {
      explanation: `Mock explanation: ${added} added, ${removed} removed, ${changed} changed. The total and the PayPal payment amount are unchanged.`,
    };
  }

  async translate(input: TranslateInput): Promise<TranslateResult> {
    return { translatedText: input.text };
  }
}
