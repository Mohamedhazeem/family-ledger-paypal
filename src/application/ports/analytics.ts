/**
 * Analytics port (ADR-0010, ADR-0016): aggregate-only reads for the
 * sponsor analytics workspace. DTOs carry counts and totals only —
 * never emails, token hashes, notes, explanations, or recipient
 * data (guardrails per ADR-0010).
 */

export interface StatusCount {
  status: string;
  count: number;
}

export interface CategoryTotal {
  category: string;
  /** Integer minor units as string (BigInt-safe over JSON). */
  amountMinor: string;
  itemCount: number;
}

export interface AnalyticsSnapshot {
  organizationId: string;
  totalDisbursements: number;
  /** Integer minor units as string. */
  totalAmountMinor: string;
  byPlanStatus: StatusCount[];
  byPaymentStatus: StatusCount[];
  byAttemptState: StatusCount[];
  categories: CategoryTotal[];
  generatedAt: string;
}

export interface AnalyticsPort {
  /** Aggregate-only snapshot scoped to one organization. */
  getAggregates(_organizationId: string): Promise<AnalyticsSnapshot>;
}
