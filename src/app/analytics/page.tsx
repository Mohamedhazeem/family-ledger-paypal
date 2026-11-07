import { AnalyticsWorkspace } from "@/components/analytics/analytics-workspace";

/**
 * GET /analytics (Slice 5.1, Part D §14G, ADR-0010).
 * The AG Studio embedded workspace renders over aggregate-only
 * DTOs; without a sponsor licence key the AG Grid fallback renders
 * the same aggregates (recorded honestly in the UI).
 */
export default function AnalyticsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Analytics</h1>
        <p className="text-sm text-slate-500">
          Aggregate programme performance — plan status, payment status and plan categories.
        </p>
      </div>
      <AnalyticsWorkspace licenseKey={process.env.AG_STUDIO_LICENSE_KEY} />
    </div>
  );
}
