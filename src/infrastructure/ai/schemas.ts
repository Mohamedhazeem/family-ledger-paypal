import { z } from "zod";

/**
 * Extraction output schema (spec §6 Step 2, §12A, ADR-0005).
 * Strict: unknown fields are rejected everywhere, `amountText` is a
 * required key (nullable — never invented), evidence is required.
 * `amountText` shape matches the money boundary rule (AGENTS §7):
 * non-negative decimal string, at most 2 decimals.
 */
const AMOUNT_TEXT_PATTERN = /^\d+(?:\.\d{1,2})?$/;

export const ExtractedPlanItemSchema = z.strictObject({
  category: z.string().min(1),
  amountText: z.string().regex(AMOUNT_TEXT_PATTERN).nullable(),
  evidenceText: z.string().min(1),
  confidence: z.number().min(0).max(1),
});

export const ExtractedPlanSchema = z.strictObject({
  summary: z.string(),
  items: z.array(ExtractedPlanItemSchema),
  requiresClarification: z.boolean(),
  clarificationQuestion: z.string().nullable(),
});

export type ExtractedPlanItem = z.infer<typeof ExtractedPlanItemSchema>;
export type ExtractedPlan = z.infer<typeof ExtractedPlanSchema>;
