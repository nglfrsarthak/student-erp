import type { ReactNode } from "react";

export function StatCard({
  label,
  value,
  hint,
  href,
}: {
  label: string;
  value: string | number;
  hint?: string;
  href?: string;
}) {
  const body = (
    <>
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p className="mt-2 text-3xl font-bold tracking-tight text-slate-900">
        {value}
      </p>
      {hint ? <p className="mt-1 text-xs text-slate-500">{hint}</p> : null}
    </>
  );

  if (href) {
    return (
      <a href={href} className="card block p-5 transition-shadow hover:shadow-md">
        {body}
      </a>
    );
  }
  return <div className="card p-5">{body}</div>;
}

export function Badge({
  children,
  tone = "slate",
}: {
  children: ReactNode;
  tone?: "slate" | "green" | "amber" | "red" | "blue" | "indigo" | "purple";
}) {
  const tones: Record<string, string> = {
    slate: "bg-slate-100 text-slate-700",
    green: "bg-emerald-100 text-emerald-800",
    amber: "bg-amber-100 text-amber-800",
    red: "bg-red-100 text-red-800",
    blue: "bg-sky-100 text-sky-800",
    indigo: "bg-indigo-100 text-indigo-800",
    purple: "bg-purple-100 text-purple-800",
  };
  return <span className={`badge ${tones[tone]}`}>{children}</span>;
}

export function StatusBadge({ status }: { status: string }) {
  const map: Record<
    string,
    { tone: "green" | "amber" | "red" | "blue" | "slate" | "indigo"; label: string }
  > = {
    ACTIVE: { tone: "green", label: "Active" },
    SUSPENDED: { tone: "amber", label: "Suspended" },
    GRADUATED: { tone: "blue", label: "Graduated" },
    DROPPED: { tone: "red", label: "Dropped" },
    ENROLLED: { tone: "green", label: "Enrolled" },
    COMPLETED: { tone: "indigo", label: "Completed" },
  };
  const entry = map[status] ?? { tone: "slate" as const, label: status };
  return <Badge tone={entry.tone}>{entry.label}</Badge>;
}

/** Empty-state placeholder used by every list. */
export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
      <div className="flex h-11 w-11 items-center justify-center rounded-full bg-slate-100 text-slate-400">
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.6}
          className="h-5 w-5"
        >
          <path d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2h7M15 19l6-6M21 13l-6 6" />
        </svg>
      </div>
      <p className="mt-3 text-sm font-semibold text-slate-900">{title}</p>
      {description ? (
        <p className="mt-1 max-w-sm text-sm text-slate-500">{description}</p>
      ) : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 className="page-title">{title}</h1>
        {subtitle ? <p className="page-subtitle">{subtitle}</p> : null}
      </div>
      {action}
    </div>
  );
}

/** Horizontal bar used for the CGPA distribution chart. */
export function BarMeter({
  value,
  max = 100,
  tone = "bg-indigo-500",
}: {
  value: number;
  max?: number;
  tone?: string;
}) {
  const pct = max === 0 ? 0 : Math.min(100, Math.max(0, (value / max) * 100));
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
      <div className={`h-full rounded-full ${tone}`} style={{ width: `${pct}%` }} />
    </div>
  );
}