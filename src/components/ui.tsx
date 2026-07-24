// Shared presentational UI primitives (no client-only features — usable in server
// and client components alike). Styling follows the Beca Tech+ design tokens in
// src/app/globals.css (source of truth: design-reference/BecaTech_Plus_Prototype.html).
import type { ReactNode } from "react";
import type { RiskLevel } from "@/generated/prisma/enums";
import { RISK_LEVEL_CLASS, RISK_LEVEL_LABEL } from "@/lib/labels";

export function PageHeader({
  title,
  subtitle,
  tag,
}: {
  title: string;
  subtitle?: string;
  /** Small monospace note aligned to the right of the title (e.g. "Years 1–2"). */
  tag?: string;
}) {
  return (
    <div className="mb-5">
      <div className="flex items-baseline justify-between gap-4">
        <h1 className="text-[22px] font-extrabold text-surface-dark">{title}</h1>
        {tag ? <span className="font-mono text-xs text-muted">{tag}</span> : null}
      </div>
      {subtitle ? (
        <p className="mt-1 max-w-[680px] text-sm leading-relaxed text-muted">{subtitle}</p>
      ) : null}
    </div>
  );
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <h2 className="mb-3 text-[13px] font-bold uppercase tracking-[0.04em] text-purple">{children}</h2>
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl border border-border bg-card p-5 ${className}`}>{children}</div>
  );
}

export function KpiCard({
  label,
  value,
  sub,
  badge,
  delta,
  deltaNote,
}: {
  label: string;
  value: ReactNode;
  /** Muted note line under the value. */
  sub?: ReactNode;
  /** Rendered at the right of the label row (e.g. a PROXY pill). */
  badge?: ReactNode;
  /** Green delta line (e.g. "+12"). */
  delta?: ReactNode;
  /** Muted suffix shown next to the delta (e.g. "this cohort"). */
  deltaNote?: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card px-[18px] py-4">
      <div className="flex items-center justify-between gap-2 text-[12.5px] text-muted">
        <span>{label}</span>
        {badge ?? null}
      </div>
      <div className="mt-2 text-[26px] font-extrabold leading-none text-surface-dark">{value}</div>
      {delta != null ? (
        <div className="mt-1 text-xs font-semibold text-green">
          {delta}
          {deltaNote ? <span className="ml-1 font-normal text-muted">{deltaNote}</span> : null}
        </div>
      ) : null}
      {sub ? <div className="mt-1 text-xs text-muted">{sub}</div> : null}
    </div>
  );
}

/** Black card with a yellow value — reserved for critical/attention numbers only. */
export function DarkCallout({
  label,
  value,
  note,
}: {
  label: ReactNode;
  value: ReactNode;
  note?: ReactNode;
}) {
  return (
    <div className="rounded-2xl bg-surface-dark px-5 py-[18px] text-white">
      <div className="text-xs text-white/55">{label}</div>
      <div className="mt-1.5 text-[28px] font-extrabold text-yellow">{value}</div>
      {note ? <div className="mt-1 text-xs text-white/55">{note}</div> : null}
    </div>
  );
}

type StatChipTone = "default" | "green" | "red";
const STAT_CHIP_BG_CLASS: Record<StatChipTone, string> = {
  default: "bg-chip-cream",
  green: "bg-mint",
  red: "bg-red-50",
};
const STAT_CHIP_VALUE_CLASS: Record<StatChipTone, string> = {
  default: "text-surface-dark",
  green: "text-green",
  red: "text-red-700",
};

/** Small filled chip for pace / participation breakdowns. */
export function StatChip({
  value,
  label,
  tone = "default",
}: {
  value: ReactNode;
  label: ReactNode;
  tone?: StatChipTone;
}) {
  return (
    <div className={`min-w-[130px] rounded-xl border border-border px-4 py-3 ${STAT_CHIP_BG_CLASS[tone]}`}>
      <div className={`text-xl font-extrabold ${STAT_CHIP_VALUE_CLASS[tone]}`}>{value}</div>
      <div className="mt-0.5 text-[11.5px] text-muted">{label}</div>
    </div>
  );
}

/** Lavender pill for a scholar's recent support activities. */
export function ActivityChip({ children }: { children: ReactNode }) {
  return (
    <span className="mr-1 mt-1 inline-block rounded-full bg-lavender px-2.5 py-1 text-[11.5px] text-purple">
      {children}
    </span>
  );
}

type StatusTone = "green" | "purple" | "amber" | "muted";
const STATUS_TONE_CLASS: Record<StatusTone, string> = {
  green: "bg-mint text-green",
  purple: "bg-lavender text-purple",
  amber: "bg-amber-100 text-amber-800",
  muted: "bg-chip-cream text-muted",
};

/** Rounded status pill (e.g. "On track · Low risk") for the profile card. */
export function StatusBadge({
  children,
  tone = "green",
}: {
  children: ReactNode;
  tone?: StatusTone;
}) {
  return (
    <span
      className={`inline-block rounded-full px-2.5 py-1 text-[11.5px] font-bold ${STATUS_TONE_CLASS[tone]}`}
    >
      {children}
    </span>
  );
}

/** Tiny "PROXY"/"PENDING" marker for KPIs that are approximations or not yet sourced. */
export function ProxyBadge({ children = "PROXY" }: { children?: ReactNode }) {
  return (
    <span className="rounded-[5px] bg-lavender px-1.5 py-0.5 text-[9.5px] font-bold text-purple">
      {children}
    </span>
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

type Tone = "slate" | "green" | "amber" | "red" | "blue" | "purple";
const TONE_CLASS: Record<Tone, string> = {
  slate: "bg-slate-100 text-slate-700 ring-slate-500/20",
  green: "bg-emerald-100 text-emerald-800 ring-emerald-600/20",
  amber: "bg-amber-100 text-amber-800 ring-amber-600/20",
  red: "bg-red-100 text-red-800 ring-red-600/20",
  blue: "bg-blue-100 text-blue-800 ring-blue-600/20",
  purple: "bg-lavender text-purple ring-purple/20",
};

export function AccessDenied({
  message = "Your role doesn't have access to this section.",
}: {
  message?: string;
}) {
  return (
    <Card className="text-center">
      <div className="py-8">
        <div className="text-lg font-semibold text-ink">Access restricted</div>
        <p className="mt-1 text-sm text-muted">{message}</p>
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
