import Link from "next/link";
import { ArrowLeft, BarChart3 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export default function AnalyticsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Analytics</h1>
        <p className="text-sm text-slate-500">AG Studio insights will appear here.</p>
      </div>
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
          <BarChart3 className="h-10 w-10 text-slate-300" />
          <p className="text-sm text-slate-600">Analytics module is under construction.</p>
          <Link href="/dashboard" className="text-sm font-medium text-indigo-600 hover:text-indigo-700">
            <ArrowLeft className="mr-1 inline h-4 w-4" />
            Back to overview
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
