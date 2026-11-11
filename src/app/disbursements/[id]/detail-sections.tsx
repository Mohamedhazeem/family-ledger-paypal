import { formatMinor } from "@/domain/value-objects/money";
import type { PlanDiff } from "@/domain/plan-diff";
import type { TimelineEntry } from "@/domain/timeline";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { ExplainDiffButton } from "@/components/disbursements/explain-diff-button";

export interface VersionItemView {
  id: string;
  versionNumber: number;
  createdByType: string;
  explanation: string | null;
  totalAllocatedMinor: bigint;
  unallocatedMinor: bigint;
  items: { id: string; category: string; amountMinor: bigint | null }[];
}

export function VersionsGrid({ versions }: { versions: VersionItemView[] }) {
  if (versions.length === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-slate-500">
          No plan versions yet. Create one from the new-disbursement flow.
        </CardContent>
      </Card>
    );
  }
  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-500">
        Versions are history, not choices — the latest version is the active shared plan. Acknowledging records your review; it never gates payment.
      </p>
      <div className="grid gap-4 md:grid-cols-2">
        {versions.map((version) => (
        <Card key={version.id} className="h-full">
          <CardContent className="flex h-full flex-col space-y-3 pt-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-base font-semibold text-slate-900">Version {version.versionNumber}</h2>
              <Badge tone={version.createdByType === "BENEFICIARY" ? "info" : "neutral"}>
                {version.createdByType === "BENEFICIARY" ? "Beneficiary" : "Coordinator"}
              </Badge>
            </div>
            {version.explanation ? (
              <p className="rounded-xl bg-slate-50 px-3 py-2 text-sm italic text-slate-600">“{version.explanation}”</p>
            ) : null}
            {version.items.length === 0 ? (
              <p className="text-sm text-slate-500">No categories in this version.</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {version.items.map((item) => (
                  <li key={item.id} className="flex items-center justify-between gap-3 py-2.5">
                    <span className="min-w-0 truncate text-sm text-slate-700">{item.category}</span>
                    <span className="shrink-0 text-sm font-semibold tabular-nums text-slate-900">
                      {item.amountMinor === null ? "Flexible" : `$${formatMinor(item.amountMinor)}`}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-auto text-xs text-slate-500">
              Allocated ${formatMinor(version.totalAllocatedMinor)} · Unallocated $
              {formatMinor(version.unallocatedMinor)}
            </p>
          </CardContent>
        </Card>
      ))}
      </div>
    </div>
  );
}

export function DiffCard({
  previousNumber,
  latestNumber,
  diff,
}: {
  previousNumber: number;
  latestNumber: number;
  diff: PlanDiff;
}) {
  return (
    <Card>
      <CardHeader
        title={`Changes: Version ${previousNumber} → Version ${latestNumber}`}
        description="Deterministic diff computed in code — AI only explains it."
      />
      <CardContent className="space-y-4">
        <ul className="space-y-2 text-sm">
          {diff.added.map((entry) => (
            <li key={`a-${entry.category}`} className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-emerald-800">
              + Added <span className="font-medium">{entry.category}</span>
              {entry.v2AmountMinor === null ? "" : ` ($${formatMinor(entry.v2AmountMinor)})`}
            </li>
          ))}
          {diff.removed.map((entry) => (
            <li key={`r-${entry.category}`} className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-rose-700">
              − Removed <span className="font-medium">{entry.category}</span>
              {entry.v1AmountMinor === null ? "" : ` ($${formatMinor(entry.v1AmountMinor)})`}
            </li>
          ))}
          {diff.changed.map((entry) => (
            <li key={`c-${entry.category}`} className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-amber-800">
              ~ <span className="font-medium">{entry.category}</span>: {entry.v1AmountMinor === null ? "—" : `$${formatMinor(entry.v1AmountMinor)}`}
              {" → "}
              {entry.v2AmountMinor === null ? "—" : `$${formatMinor(entry.v2AmountMinor)}`}
              {entry.deltaMinor === null
                ? ""
                : ` (${entry.deltaMinor > 0n ? "+" : ""}$${formatMinor(entry.deltaMinor < 0n ? -entry.deltaMinor : entry.deltaMinor)})`}
            </li>
          ))}
          {diff.unchanged.map((entry) => (
            <li key={`u-${entry.category}`} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-slate-500">
              = {entry.category} unchanged
            </li>
          ))}
        </ul>
        <ExplainDiffButton
          diff={JSON.parse(
            JSON.stringify(diff, (_key, value) => (typeof value === "bigint" ? value.toString() : value)),
          )}
        />
      </CardContent>
    </Card>
  );
}

export function TimelineCard({ timeline }: { timeline: TimelineEntry[] }) {
  return (
    <Card>
      <CardHeader title="Timeline" description="Append-only shared history." />
      <CardContent>
        {timeline.length === 0 ? (
          <p className="py-6 text-center text-sm text-slate-500">No events yet.</p>
        ) : (
          <ol className="relative space-y-5 border-l-2 border-slate-100 pl-5">
            {timeline.map((entry, index) => (
              <li key={`${entry.eventType}-${index}`} className="relative">
                <span className="absolute -left-6.75 top-1 h-3 w-3 rounded-full border-2 border-white bg-indigo-500 shadow" />
                <p className="text-sm font-medium leading-snug text-slate-700">{entry.label}</p>
                <time className="mt-1 block text-xs tabular-nums text-slate-400">
                  {entry.createdAt.toLocaleString()}
                </time>
              </li>
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}
