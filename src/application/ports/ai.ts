/**
 * AiProvider port (ADR-0005, ADR-0016, ADR-0017, spec Part C §12).
 * Defined in the application layer; adapters implement it from the
 * environment. No vendor SDK imports here.
 */

export interface AiPingResult {
  provider: string;
  model: string;
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

export interface AiProvider {
  /** Config probe: returns the configured provider and model name. */
  ping(): Promise<AiPingResult>;
  /**
   * Extracts a proposed plan from the note. The adapter validates the
   * model output against the extraction schema before returning.
   */
  parseIntent(_input: ParseIntentInput): Promise<ExtractedPlan>;
}
