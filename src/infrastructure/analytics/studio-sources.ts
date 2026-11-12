import type { AgFieldDefinition } from "ag-studio";
import type { AnalyticsSnapshot } from "@/application/ports/analytics";

/**
 * Maps the aggregate DTOs onto AG Studio's client-side data sources
 * (ADR-0010). Rows are plain aggregate objects — no PII by
 * construction (the DTOs cannot carry any).
 *
 * Fields are declared explicitly (rather than inferred from the data) so
 * that a source with zero rows still advertises its schema. AG Studio
 * rejects sources with no fields, which previously surfaced as
 * "Source '<id>' has no fields" on a fresh database.
 */
export interface StudioDataSource {
  id: string;
  data: Record<string, string | number>[];
  fields: AgFieldDefinition[];
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
      fields: [
        { id: "category", format: "textFormat" },
        { id: "amount_minor", format: "integerFormat" },
        { id: "item_count", format: "integerFormat" },
      ],
    },
    {
      // Field ids are unique across all sources so widget data mappings can
      // reference them unambiguously ("status"/"count" would collide).
      id: "plan_status",
      data: snapshot.byPlanStatus.map((row) => ({ plan_status: row.status, plan_count: row.count })),
      fields: [
        { id: "plan_status", format: "textFormat" },
        { id: "plan_count", format: "integerFormat" },
      ],
    },
    {
      id: "payment_status",
      data: snapshot.byPaymentStatus.map((row) => ({ payment_status: row.status, payment_count: row.count })),
      fields: [
        { id: "payment_status", format: "textFormat" },
        { id: "payment_count", format: "integerFormat" },
      ],
    },
    {
      id: "attempt_state",
      data: snapshot.byAttemptState.map((row) => ({ attempt_state: row.status, attempt_count: row.count })),
      fields: [
        { id: "attempt_state", format: "textFormat" },
        { id: "attempt_count", format: "integerFormat" },
      ],
    },
  ];
}
