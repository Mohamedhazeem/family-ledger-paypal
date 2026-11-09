import type { AgReportState } from "ag-studio";

/**
 * Pre-built AG Studio board over the aggregate sources from
 * `toStudioSources` (ADR-0010). Passed as Studio's `initialState`
 * so /analytics opens on a filled dashboard instead of an empty
 * edit canvas; the coordinator can still switch to edit mode and
 * rearrange or add widgets. Aggregate-only by construction.
 */
const PAGE_ID = "programme-overview";

/** Compact widget title: Studio's 24px default dwarfs the board. */
const title = (text: string) => ({
  text,
  enabled: true,
  typography: { fontSize: 12, fontWeight: "bold" as const },
});

export function buildDefaultDashboardState(): AgReportState {
  return {
    pages: [
      {
        id: PAGE_ID,
        layout: { columns: 12, rowHeight: 24 },
        widgets: {
          "kpi-amount": {
            type: "value",
            dataMapping: { value: [{ id: "categories.amount_minor", aggregation: "sum" }] },
            format: { title: title("Total allocated (minor units)") },
          },
          "kpi-items": {
            type: "value",
            dataMapping: { value: [{ id: "categories.item_count", aggregation: "sum" }] },
            format: { title: title("Plan items") },
          },
          "kpi-statuses": {
            type: "value",
            dataMapping: { value: [{ id: "plan_status.plan_count", aggregation: "sum" }] },
            format: { title: title("Status entries") },
          },
          "chart-category": {
            type: "column-chart-grouped",
            dataMapping: {
              categoryKey: [{ id: "categories.category" }],
              valueKey: [{ id: "categories.amount_minor", aggregation: "sum" }],
            },
            format: { title: title("Allocated by category") },
          },
          "chart-plan-status": {
            type: "donut-chart",
            dataMapping: {
              categoryKey: [{ id: "plan_status.plan_status" }],
              valueKey: [{ id: "plan_status.plan_count", aggregation: "sum" }],
            },
            format: { title: title("Plan status") },
          },
          "chart-payment-status": {
            type: "bar-chart-grouped",
            dataMapping: {
              categoryKey: [{ id: "payment_status.payment_status" }],
              valueKey: [{ id: "payment_status.payment_count", aggregation: "sum" }],
            },
            format: { title: title("Payment status") },
          },
          "chart-attempt-state": {
            type: "bar-chart-grouped",
            dataMapping: {
              categoryKey: [{ id: "attempt_state.attempt_state" }],
              valueKey: [{ id: "attempt_state.attempt_count", aggregation: "sum" }],
            },
            format: { title: title("Payout attempts") },
          },
        },
        widgetLayout: {
          "kpi-amount": { xTrack: 0, yTrack: 0, xSpan: 4, ySpan: 3 },
          "kpi-items": { xTrack: 4, yTrack: 0, xSpan: 4, ySpan: 3 },
          "kpi-statuses": { xTrack: 8, yTrack: 0, xSpan: 4, ySpan: 3 },
          "chart-category": { xTrack: 0, yTrack: 3, xSpan: 6, ySpan: 10 },
          "chart-plan-status": { xTrack: 6, yTrack: 3, xSpan: 6, ySpan: 10 },
          "chart-payment-status": { xTrack: 0, yTrack: 13, xSpan: 6, ySpan: 9 },
          "chart-attempt-state": { xTrack: 6, yTrack: 13, xSpan: 6, ySpan: 9 },
        },
      },
    ],
    selectedPageId: PAGE_ID,
  };
}
