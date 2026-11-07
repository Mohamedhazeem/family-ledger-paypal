import type { AnalyticsSnapshot } from "@/application/ports/analytics";

/**
 * Maps the aggregate DTOs onto AG Studio's client-side data sources
 * (ADR-0010). Rows are plain aggregate objects — no PII by
 * construction (the DTOs cannot carry any).
 */
export interface StudioDataSource {
  id: string;
  data: Record<string, string | number>[];
}

export function toStudioSources(snapshot: AnalyticsSnapshot): StudioDataSource[] {
  return [
    {
      id: "categories",
      data: snapshot.categories.map((row) => ({
        category: row.category,
        amount_minor: Number(row.amountMinor),
        item_count: row.itemCount,
      })),
    },
    {
      id: "plan_status",
      data: snapshot.byPlanStatus.map((row) => ({ status: row.status, count: row.count })),
    },
    {
      id: "payment_status",
      data: snapshot.byPaymentStatus.map((row) => ({ status: row.status, count: row.count })),
    },
    {
      id: "attempt_state",
      data: snapshot.byAttemptState.map((row) => ({ status: row.status, count: row.count })),
    },
  ];
}
