/**
 * AiProvider port (ADR-0005, ADR-0016, ADR-0017, spec Part C §12).
 * Defined in the application layer; adapters implement it from the
 * environment. No vendor SDK imports here.
 */
import type { PlanDiff } from "@/domain/plan-diff";

export interface AiPingResult {
  provider: string;
  model: string;
}

export interface ExplainDiffResult {
  /** Neutral, short explanation produced by the model from the diff only. */
  explanation: string;
}

export interface ParseIntentInput {
  note: string;
  /** Full disbursement amount in integer minor units (BigInt). */
  amountMinor: bigint;
  currency: string;
}

export interface ExtractedPlanItem {
  category: string;
  /** Decimal string when the note states an amount; null otherwise. */
  amountText: string | null;
  evidenceText: string;
  confidence: number;
}

export interface ExtractedPlan {
  summary: string;
  items: ExtractedPlanItem[];
  requiresClarification: boolean;
  clarificationQuestion: string | null;
}

export interface TranslateInput {
  text: string;
  /** Target display language: en, ta, or hi. */
  targetLang: "en" | "ta" | "hi";
}

export interface TranslateResult {
  /** Translated text. Canonical amounts and IDs are never translated. */
  translatedText: string;
}

export interface AiProvider {
  /** Config probe: returns the configured provider and model name. */
  ping(): Promise<AiPingResult>;
  /**
   * Extracts a proposed plan from the note. The adapter validates the
   * model output against the extraction schema before returning.
   */
  parseIntent(_input: ParseIntentInput): Promise<ExtractedPlan>;
  /**
   * Explains a deterministic diff between two plan versions. The model
   * receives only the diff; it must not compute amounts.
   */
  explainDiff(_diff: PlanDiff): Promise<ExplainDiffResult>;
  /**
   * Translates display labels/explanations only (spec §12C). Amounts,
   * references, and IDs must pass through unchanged.
   */
  translate(_input: TranslateInput): Promise<TranslateResult>;
}
