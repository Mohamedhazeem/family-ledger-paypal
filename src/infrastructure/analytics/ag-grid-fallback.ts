import type { AnalyticsSnapshot } from "@/application/ports/analytics";

/**
 * AG Grid fallback adapter (ADR-0010, ADR-0016): builds the same
 * aggregate-only table model the Studio dashboard renders from, so
 * the fallback path is a swappable adapter rather than inline
 * component logic. Rows carry counts and totals only — never PII.
 */

export interface GridFallbackCategoryRow {
  category: string;
  amountMinor: string;
  itemCount: number;
}

export interface GridFallbackStatusRow {
  status: string;
  count: number;
}

export interface GridFallbackModel {
  totals: {
    totalDisbursements: number;
    totalAmountMinor: string;
  };
  categories: GridFallbackCategoryRow[];
  byPlanStatus: GridFallbackStatusRow[];
  byPaymentStatus: GridFallbackStatusRow[];
  byAttemptState: GridFallbackStatusRow[];
}

export function buildGridFallbackModel(snapshot: AnalyticsSnapshot): GridFallbackModel {
  return {
    totals: {
      totalDisbursements: snapshot.totalDisbursements,
      totalAmountMinor: snapshot.totalAmountMinor,
    },
    categories: snapshot.categories.map((row) => ({
      category: row.category,
      amountMinor: row.amountMinor,
      itemCount: row.itemCount,
    })),
    byPlanStatus: snapshot.byPlanStatus.map((row) => ({ status: row.status, count: row.count })),
    byPaymentStatus: snapshot.byPaymentStatus.map((row) => ({ status: row.status, count: row.count })),
    byAttemptState: snapshot.byAttemptState.map((row) => ({ status: row.status, count: row.count })),
  };
}
