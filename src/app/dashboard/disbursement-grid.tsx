"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { AllCommunityModule, ModuleRegistry, themeQuartz } from "ag-grid-community";
import { AgGridReact } from "ag-grid-react";
import { Search, X } from "lucide-react";
import { formatMinor } from "@/domain/value-objects/money";
import {
  formatCreatedDate,
  formatStatusLabel,
  initials,
  sumMinor,
  toneForStatus,
  type StatusTone,
} from "./disbursement-formatting";

ModuleRegistry.registerModules([AllCommunityModule]);

const theme = themeQuartz.withParams({
  accentColor: "#4f46e5",
  spacing: 8,
  fontSize: 13,
  headerFontSize: 11,
  fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif",
  headerFontFamily: "Inter, ui-sans-serif, system-ui, sans-serif",
  wrapperBorderRadius: 12,
});

// Custom header filter icon: horizontal sliders instead of the
// default funnel, themed with currentColor so it follows the grid.
const SLIDERS_ICON = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="21" x2="14" y1="4" y2="4"/><line x1="10" x2="3" y1="4" y2="4"/><line x1="21" x2="12" y1="12" y2="12"/><line x1="8" x2="3" y1="12" y2="12"/><line x1="21" x2="16" y1="20" y2="20"/><line x1="12" x2="3" y1="20" y2="20"/><line x1="14" x2="14" y1="2" y2="6"/><line x1="8" x2="8" y1="10" y2="14"/><line x1="16" x2="16" y1="18" y2="22"/></svg>`;

export type DisbursementRow = {
  id: string;
  publicReference: string;
  beneficiary: string;
  amountMinor: string;
  planStatus: string;
  paypalBatchStatus: string | null;
  paypalItemStatus: string | null;
  createdAt: string;
};

const PILL_TONES: Record<StatusTone, string> = {
  neutral: "border-slate-200 bg-slate-50 text-slate-600",
  info: "border-indigo-200 bg-indigo-50 text-indigo-700",
  success: "border-emerald-200 bg-emerald-50 text-emerald-700",
  warning: "border-amber-200 bg-amber-50 text-amber-700",
  danger: "border-rose-200 bg-rose-50 text-rose-700",
};

const DOT_TONES: Record<StatusTone, string> = {
  neutral: "bg-slate-400",
  info: "bg-indigo-500",
  success: "bg-emerald-500",
  warning: "bg-amber-500",
  danger: "bg-rose-500",
};

function StatusPill({ status }: { status: string | null }) {
  if (!status) return <span className="text-slate-300">—</span>;
  const tone = toneForStatus(status);
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${PILL_TONES[tone]}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${DOT_TONES[tone]}`} />
      {formatStatusLabel(status)}
    </span>
  );
}

const AVATAR_TONES = [
  "bg-indigo-100 text-indigo-700",
  "bg-emerald-100 text-emerald-700",
  "bg-amber-100 text-amber-700",
  "bg-sky-100 text-sky-700",
  "bg-rose-100 text-rose-700",
];

function avatarTone(name: string): string {
  let hash = 0;
  for (const ch of name) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return AVATAR_TONES[hash % AVATAR_TONES.length]!;
}

function BeneficiaryCell({ value }: { value: string }) {
  return (
    <span className="inline-flex items-center gap-2.5 font-medium text-slate-800">
      <span
        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold ${avatarTone(value)}`}
      >
        {initials(value)}
      </span>
      {value}
    </span>
  );
}

function ReferenceCell({ value, id }: { value: string; id: string }) {
  return (
    <Link
      href={`/disbursements/${id}`}
      className="font-mono text-[13px] font-medium text-indigo-600 underline-offset-2 transition-colors hover:text-indigo-800 hover:underline"
    >
      {value}
    </Link>
  );
}

export function DisbursementGrid({ rows }: { rows: DisbursementRow[] }) {
  const apiRef = useRef<any>(null);
  const [query, setQuery] = useState("");
  const total = useMemo(() => sumMinor(rows.map((r) => r.amountMinor)), [rows]);

  const columnDefs: any[] = [
    {
      field: "publicReference",
      headerName: "Reference",
      pinned: "left",
      flex: 1.1,
      minWidth: 140,
      cellRenderer: (p: any) => <ReferenceCell value={p.value} id={p.data.id} />,
      cellClass: "ag-register-center",
    },
    {
      field: "beneficiary",
      headerName: "Beneficiary",
      flex: 1.2,
      minWidth: 160,
      cellRenderer: (p: any) => <BeneficiaryCell value={p.value} />,
      cellClass: "ag-register-center",
    },
    {
      field: "amountMinor",
      headerName: "Amount",
      minWidth: 110,
      sortable: true,
      valueGetter: (p: any) => BigInt(p.data.amountMinor),
      valueFormatter: (p: any) => `$${formatMinor(BigInt(p.value))}`,
      cellClass: "ag-register-center font-semibold tabular-nums text-slate-900",
    },
    {
      field: "planStatus",
      headerName: "Plan status",
      flex: 1,
      minWidth: 150,
      filter: true,
      cellRenderer: (p: any) => <StatusPill status={p.value} />,
      cellClass: "ag-register-center",
    },
    {
      field: "paypalBatchStatus",
      headerName: "PayPal batch",
      flex: 0.9,
      minWidth: 130,
      cellRenderer: (p: any) => <StatusPill status={p.value} />,
      cellClass: "ag-register-center",
    },
    {
      field: "paypalItemStatus",
      headerName: "PayPal item",
      flex: 0.9,
      minWidth: 130,
      cellRenderer: (p: any) => <StatusPill status={p.value} />,
      cellClass: "ag-register-center",
    },
    {
      field: "createdAt",
      headerName: "Created",
      minWidth: 120,
      valueFormatter: (p: any) => formatCreatedDate(p.value),
      cellClass: "ag-register-center text-slate-500",
    },
  ];

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={query}
            onChange={(e) => {
              const next = e.target.value;
              setQuery(next);
              apiRef.current?.setGridOption("quickFilterText", next);
            }}
            placeholder="Search reference, beneficiary, status…"
            className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-9 pr-9 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-indigo-300 focus:bg-white focus:ring-4 focus:ring-indigo-100"
          />
          {query ? (
            <button
              type="button"
              aria-label="Clear search"
              onClick={() => {
                setQuery("");
                apiRef.current?.setGridOption("quickFilterText", "");
              }}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-full p-1 text-slate-400 transition hover:bg-slate-200 hover:text-slate-600"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          ) : null}
        </div>
        <p className="shrink-0 text-sm text-slate-500">
          <span className="font-semibold text-slate-900">{rows.length}</span>{" "}
          {rows.length === 1 ? "disbursement" : "disbursements"} ·{" "}
          <span className="font-semibold tabular-nums text-slate-900">${formatMinor(total)}</span> total
        </p>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200" style={{ height: 520 }}>
        <AgGridReact
          theme={theme}
          icons={{ filter: SLIDERS_ICON }}
          rowData={rows}
          columnDefs={columnDefs}
          onGridReady={(e) => {
            apiRef.current = e.api;
            if (query) e.api.setGridOption("quickFilterText", query);
          }}
          defaultColDef={{ sortable: true, filter: true, resizable: true, minWidth: 100 }}
          rowHeight={48}
          pagination
          paginationPageSize={10}
          paginationPageSizeSelector={[10, 25, 50]}
          overlayNoRowsTemplate={`<span class="text-sm text-slate-400">No disbursements match “${query}”.</span>`}
        />
      </div>
    </div>
  );
}
