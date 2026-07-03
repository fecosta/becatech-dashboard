// Shared presentational UI primitives (no client-only features — usable in server
// and client components alike).
import type { ReactNode } from "react";
import type { RiskLevel } from "@/generated/prisma/enums";
import { RISK_LEVEL_CLASS, RISK_LEVEL_LABEL } from "@/lib/labels";

export function PageHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-6">
      <h1 className="text-xl font-semibold text-slate-900">{title}</h1>
      {subtitle ? <p className="mt-1 text-sm text-slate-500">{subtitle}</p> : null}
    </div>
  );
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return <h2 className="mb-3 text-sm font-semibold text-slate-700">{children}</h2>;
}

export function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`rounded-xl border border-slate-200 bg-white p-5 shadow-sm ${className}`}>
      {children}
    </div>
  );
}

export function KpiCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="text-sm font-medium text-slate-500">{label}</div>
      <div className="mt-1 text-2xl font-semibold text-slate-900">{value}</div>
      {sub ? <div className="mt-1 text-xs text-slate-400">{sub}</div> : null}
    </div>
  );
}

export function RiskBadge({ level }: { level: RiskLevel }) {
  return (
    <span
      className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${RISK_LEVEL_CLASS[level]}`}
    >
      {RISK_LEVEL_LABEL[level]}
    </span>
  );
}

type Tone = "slate" | "green" | "amber" | "red" | "blue";
const TONE_CLASS: Record<Tone, string> = {
  slate: "bg-slate-100 text-slate-700 ring-slate-500/20",
  green: "bg-emerald-100 text-emerald-800 ring-emerald-600/20",
  amber: "bg-amber-100 text-amber-800 ring-amber-600/20",
  red: "bg-red-100 text-red-800 ring-red-600/20",
  blue: "bg-blue-100 text-blue-800 ring-blue-600/20",
};

export function AccessDenied({
  message = "Tu rol no tiene acceso a esta sección.",
}: {
  message?: string;
}) {
  return (
    <Card className="text-center">
      <div className="py-8">
        <div className="text-lg font-semibold text-slate-700">Acceso restringido</div>
        <p className="mt-1 text-sm text-slate-500">{message}</p>
      </div>
    </Card>
  );
}

export function Badge({ children, tone = "slate" }: { children: ReactNode; tone?: Tone }) {
  return (
    <span
      className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${TONE_CLASS[tone]}`}
    >
      {children}
    </span>
  );
}
