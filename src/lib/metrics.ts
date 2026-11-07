import type { PaymentStatus, PlanStatus } from "@/domain/entities/disbursement";
import type { TimelineEntry } from "@/domain/timeline";

/**
 * Dashboard metrics inputs (Slice 5.5, spec §14B): counted in the
 * dashboard itself from real rows — never fabricated from AI.
 */
export interface MetricsDisbursement {
  planStatus: PlanStatus;
  paymentStatus: PaymentStatus;
  amountMinor: bigint;
}

export interface DashboardMetrics {
  totalDisbursements: number;
  totalSentMinor: bigint;
  pendingCount: number;
  awaitingReviewCount: number;
  revisionCount: number;
  failedOrUnclaimedCount: number;
  recentActivity: TimelineEntry[];
}

const FAILED_OR_UNCLAIMED: ReadonlySet<PaymentStatus> = new Set([
  "FAILED",
  "UNCLAIMED",
  "RETURNED",
  "REFUNDED",
  "REVERSED",
]);

/**
 * Pure counting over real rows (spec §14B):
 * - total sent: SUCCESS-mapped payments only
 * - pending: pre-send payment states
 * - awaiting review: REVISION_PROPOSED plans
 * - failed/unclaimed: FAILED/UNCLAIMED-ish payment states
 */
export function computeDashboardMetrics(
  disbursements: MetricsDisbursement[],
  revisionCount: number,
  recentActivity: TimelineEntry[],
): DashboardMetrics {
  return {
    totalDisbursements: disbursements.length,
    totalSentMinor: disbursements
      .filter((d) => d.paymentStatus === "SUCCESS")
      .reduce((acc, d) => acc + d.amountMinor, 0n),
    pendingCount: disbursements.filter(
      (d) => d.paymentStatus === "NOT_SENT" || d.paymentStatus === "READY",
    ).length,
    awaitingReviewCount: disbursements.filter((d) => d.planStatus === "REVISION_PROPOSED").length,
    revisionCount,
    failedOrUnclaimedCount: disbursements.filter((d) => FAILED_OR_UNCLAIMED.has(d.paymentStatus)).length,
    recentActivity,
  };
}
