"use client";
import { AllCommunityModule, ModuleRegistry } from "ag-grid-community";
import { AgGridReact } from "ag-grid-react";
import "ag-grid-community/styles/ag-grid.css";
import "ag-grid-community/styles/ag-theme-quartz.css";

ModuleRegistry.registerModules([AllCommunityModule]);

export type DisbursementRow = {
  publicReference: string;
  beneficiary: string;
  amountMinor: string;
  planStatus: string;
  paypalBatchStatus: string | null;
  paypalItemStatus: string | null;
  createdAt: string;
};

export function DisbursementGrid({ rows }: { rows: DisbursementRow[] }) {
  const columnDefs: any[] = [
    { field: "publicReference", headerName: "Reference", sortable: true, filter: true },
    { field: "beneficiary", headerName: "Beneficiary", sortable: true, filter: true },
    { field: "amountMinor", headerName: "Amount (minor)", sortable: true },
    { field: "planStatus", headerName: "Plan status", sortable: true, filter: true },
    { field: "paypalBatchStatus", headerName: "PayPal batch", sortable: true },
    { field: "paypalItemStatus", headerName: "PayPal item", sortable: true },
    { field: "createdAt", headerName: "Created", sortable: true },
    { headerName: "Actions", cellRenderer: () => "view" },
  ];
  return (
    <div className="ag-theme-quartz" style={{ height: 400, width: "100%" }}>
      <AgGridReact rowData={rows} columnDefs={columnDefs} />
    </div>
  );
}
