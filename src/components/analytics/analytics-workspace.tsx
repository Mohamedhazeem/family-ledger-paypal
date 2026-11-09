"use client";

import { useEffect, useState, type ComponentType, type ReactNode } from "react";
import type { AnalyticsSnapshot } from "@/application/ports/analytics";
import { toStudioSources } from "@/infrastructure/analytics/studio-sources";
import { buildDefaultDashboardState } from "@/infrastructure/analytics/studio-default-dashboard";
import { buildGridFallbackModel } from "@/infrastructure/analytics/ag-grid-fallback";
import { minorToDecimal } from "@/components/disbursements/money-client";

type StudioComponent<P> = ComponentType<P>;

interface StudioModule {
  AgStudioProvider: StudioComponent<{ licenseKey?: string; children: ReactNode }>;
  AgStudio: StudioComponent<Record<string, unknown>>;
}

/**
 * Analytics workspace (Slice 5.1, ADR-0010). Renders the AG Studio
 * embedded dashboard when a sponsor licence key is available;
 * otherwise the AG Grid fallback over the same aggregate DTOs
 * (the AGENTS §4 / ADR-0010 fallback, recorded honestly).
 */
export function AnalyticsWorkspace({
  licenseKey,
  initialSnapshot,
}: {
  licenseKey?: string;
  initialSnapshot?: AnalyticsSnapshot;
}) {
  const [snapshot, setSnapshot] = useState<AnalyticsSnapshot | null>(initialSnapshot ?? null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (initialSnapshot) return;
    fetch("/api/analytics/aggregates")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) setSnapshot(data);
        else setFailed(true);
      })
      .catch(() => setFailed(true));
  }, [initialSnapshot]);

  if (!snapshot) {
    return (
      <p className="text-sm text-slate-500">
        {failed
          ? "Could not load programme aggregates. Check the API and try again."
          : "Loading analytics…"}
      </p>
    );
  }

  if (licenseKey) {
    return <StudioDashboard snapshot={snapshot} licenseKey={licenseKey} />;
  }
  return <GridFallback snapshot={snapshot} />;
}

function StudioDashboard({
  snapshot,
  licenseKey,
}: {
  snapshot: AnalyticsSnapshot;
  licenseKey: string;
}) {
  const [mod, setMod] = useState<StudioModule | null>(null);
  // Open on the pre-built board; "Customise" switches to Studio's edit mode.
  const [mode, setMode] = useState<"view" | "edit">("view");

  useEffect(() => {
    let cancelled = false;
    import("ag-studio-react")
      .then((loaded) => {
        if (!cancelled) {
          setMod({
            AgStudioProvider: loaded.AgStudioProvider as StudioComponent<{
              licenseKey?: string;
              children: ReactNode;
            }>,
            AgStudio: loaded.AgStudio as StudioComponent<Record<string, unknown>>,
          });
        }
      })
      .catch(() => setMod(null));
    return () => {
      cancelled = true;
    };
  }, []);

  if (!mod) {
    return <GridFallback snapshot={snapshot} />;
  }
  const AgStudioProvider = mod.AgStudioProvider;
  const AgStudio = mod.AgStudio;
  return (
    <AgStudioProvider licenseKey={licenseKey}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-xs text-slate-500">
          {mode === "view"
            ? "Pre-built overview of the same aggregates."
            : "Drag widgets onto the board to make it yours."}
        </p>
        <div className="inline-flex rounded-xl border border-slate-200 bg-slate-50 p-1">
          <button
            type="button"
            onClick={() => setMode("view")}
            aria-pressed={mode === "view"}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
              mode === "view" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
            }`}
          >
            Dashboard
          </button>
          <button
            type="button"
            onClick={() => setMode("edit")}
            aria-pressed={mode === "edit"}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
              mode === "edit" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
            }`}
          >
            Customise
          </button>
        </div>
      </div>
      <div className="overflow-hidden rounded-2xl border border-slate-200" style={{ height: 640 }}>
        <AgStudio
          data={{ sources: toStudioSources(snapshot) }}
          initialState={buildDefaultDashboardState()}
          mode={mode}
          // Let the coordinator add filters straight from the view-mode
          // Filters panel instead of forcing a trip through Customise.
          enableFilterEditingInViewMode={true}
        />
      </div>
    </AgStudioProvider>
  );
}

function GridFallback({ snapshot }: { snapshot: AnalyticsSnapshot }) {
  const model = buildGridFallbackModel(snapshot);
  return (
    <div className="space-y-4">
      <p className="text-xs text-slate-500">
        AG Grid fallback (no sponsor licence key configured) — aggregate-only view.
      </p>
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-200 px-4 py-3">
          <p className="text-sm text-slate-500">Disbursements</p>
          <p className="text-2xl font-bold tabular-nums text-slate-900">{model.totals.totalDisbursements}</p>
        </div>
        <div className="rounded-xl border border-slate-200 px-4 py-3">
          <p className="text-sm text-slate-500">Total amount</p>
          <p className="text-2xl font-bold tabular-nums text-slate-900">
            ${minorToDecimal(Number(model.totals.totalAmountMinor))}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 px-4 py-3">
          <p className="text-sm text-slate-500">Categories</p>
          <p className="text-2xl font-bold tabular-nums text-slate-900">{model.categories.length}</p>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        {model.byPlanStatus.map((row) => (
          <span
            key={row.status}
            className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs text-slate-600"
          >
            {row.status}: <span className="font-semibold">{row.count}</span>
          </span>
        ))}
      </div>
      <div className="overflow-hidden rounded-xl border border-slate-200">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-2.5">Category</th>
              <th className="px-4 py-2.5 text-right">Allocated</th>
              <th className="px-4 py-2.5 text-right">Items</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {model.categories.map((row) => (
              <tr key={row.category}>
                <td className="px-4 py-2.5 font-medium text-slate-700">{row.category}</td>
                <td className="px-4 py-2.5 text-right font-semibold tabular-nums text-slate-900">
                  ${minorToDecimal(Number(row.amountMinor))}
                </td>
                <td className="px-4 py-2.5 text-right tabular-nums text-slate-600">{row.itemCount}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
