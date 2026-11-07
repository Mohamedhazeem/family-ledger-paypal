import { toMinorUnits } from "@/domain/value-objects/money";
import type { AiProvider, ExtractedPlan, ParseIntentInput } from "@/application/ports/ai";

/**
 * ParseSupportIntent use case (Slice 2.3, spec §6 Step 2).
 * Calls the AiProvider port and applies only deterministic rules:
 * items come back untouched (null amounts are never invented or
 * split); over-total allocations flag clarification. Depends only
 * on the port and the domain money value object.
 */
export class ParseSupportIntent {
  private readonly provider: AiProvider;

  constructor(provider: AiProvider) {
    this.provider = provider;
  }

  async execute(input: ParseIntentInput): Promise<ExtractedPlan> {
    const plan = await this.provider.parseIntent(input);
    const totalMinor = plan.items.reduce(
      (acc, item) => acc + (item.amountText === null ? 0n : toMinorUnits(item.amountText)),
      0n,
    );
    if (totalMinor > input.amountMinor) {
      return {
        ...plan,
        requiresClarification: true,
        clarificationQuestion:
          plan.clarificationQuestion ??
          "The extracted categories total more than the disbursement amount. Please adjust the allocations.",
      };
    }
    return plan;
  }
}
