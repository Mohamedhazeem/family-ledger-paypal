import type { ReactNode } from "react";

export function Card({
  className = "",
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={`rounded-3xl border border-slate-200/70 bg-white shadow-[0_2px_16px_-6px_rgba(15,23,42,0.08)] transition-shadow hover:shadow-[0_10px_36px_-12px_rgba(15,23,42,0.14)] ${className}`}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 px-5 pt-5 sm:px-6 sm:pt-6">
      <div className="min-w-0">
        <h3 className="text-base font-semibold tracking-tight text-slate-900">{title}</h3>
        {description ? <p className="mt-1 text-sm text-slate-500">{description}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function CardContent({ className = "", children }: { className?: string; children: ReactNode }) {
  return <div className={`px-5 pb-5 pt-4 sm:px-6 sm:pb-6 ${className}`}>{children}</div>;
}
