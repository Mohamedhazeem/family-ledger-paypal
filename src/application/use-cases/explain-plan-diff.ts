import { formatMinor } from "@/domain/value-objects/money";
import type { PlanDiff } from "@/domain/plan-diff";
import type { AiProvider } from "@/application/ports/ai";

export interface ExplainPlanDiffResult {
  explanation: string;
  source: "ai" | "template";
}

/**
 * ExplainPlanDiff use case (Slice 3.6, spec §12B): the AI receives
 * only the deterministic diff and explains it. Unchanged plans never
 * reach the model; AI failure falls back to a deterministic template.
 */
export class ExplainPlanDiff {
  private readonly provider: AiProvider;

  constructor(provider: AiProvider) {
    this.provider = provider;
  }

  async execute(diff: PlanDiff): Promise<ExplainPlanDiffResult> {
    const hasChanges =
      diff.added.length > 0 || diff.removed.length > 0 || diff.changed.length > 0;
    if (!hasChanges) {
      return { explanation: "No changes between the two plan versions.", source: "template" };
    }
    try {
      const { explanation } = await this.provider.explainDiff(diff);
      return { explanation, source: "ai" };
    } catch {
      return { explanation: deterministicTemplate(diff), source: "template" };
    }
  }
}

/**
 * Deterministic fallback, built only from the computed diff.
 * Amounts are summed from exact minor-unit deltas.
 */
export function deterministicTemplate(diff: PlanDiff): string {
  let total = 0n;
  for (const entry of [...diff.added, ...diff.removed, ...diff.changed]) {
    if (entry.deltaMinor !== null) total += entry.deltaMinor;
  }
  const sign = total > 0n ? "+" : total < 0n ? "-" : "";
  const absolute = total < 0n ? -total : total;
  const parts: string[] = [];
  if (diff.added.length > 0) parts.push(`${diff.added.length} added`);
  if (diff.removed.length > 0) parts.push(`${diff.removed.length} removed`);
  if (diff.changed.length > 0) parts.push(`${diff.changed.length} changed`);
  return `Plan changed (${parts.join(", ")}). Net change: ${sign}$${formatMinor(absolute)}.`;
}
