// Shared presentational UI primitives (no client-only features — usable in server
// and client components alike). Styling follows the Beca Tech+ design tokens in
// src/app/globals.css (source of truth: design-reference/MVP_Dashboard AUGUST 4.html).
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
        <h1 className="font-display text-[26px] font-bold text-surface-dark">{title}</h1>
        {tag ? <span className="font-mono text-xs text-muted">{tag}</span> : null}
      </div>
      {subtitle ? (
        <p className="mt-1 max-w-[680px] text-sm leading-relaxed text-muted">{subtitle}</p>
      ) : null}
    </div>
  );
}

/**
 * Section heading, in the two sizes the design uses.
 *
 * "sm" is the small uppercase purple eyebrow used inside a view. "lg" is the
 * numbered outline heading ("1 · Our Scholars") that AUGUST 4 puts at the top of
 * every top-level section — display serif, sentence case. Home used to carry its
 * own local copy of this; it lives here now so the two cannot drift.
 *
 * The number is passed as part of `children`, not generated: sections get
 * renumbered whenever one is added or dropped, so it is content, not structure.
 */
export function SectionTitle({
  children,
  size = "sm",
  note,
  id,
}: {
  children: ReactNode;
  size?: "sm" | "lg";
  /** Muted, normal-weight trailing gloss (e.g. "— department of origin"). */
  note?: ReactNode;
  /** Anchor target, matching the design's id="home-sec-1" outline links. */
  id?: string;
}) {
  const large = size === "lg";
  return (
    <h2
      id={id}
      className={
        large
          ? "mb-3.5 mt-[34px] font-display text-[22px] font-bold text-surface-dark"
          : "mb-3 text-[13px] font-bold uppercase tracking-[0.04em] text-purple"
      }
    >
      {children}
      {note ? (
        <span
          className={
            large
              ? "ml-2 text-sm font-normal text-muted"
              : "ml-1 font-normal normal-case tracking-normal text-muted"
          }
        >
          {note}
        </span>
      ) : null}
    </h2>
  );
}

export function Card({
  children,
  className = "",
  padded = true,
}: {
  children: ReactNode;
  className?: string;
  /** Drop the default p-5 when the content owns its own padding (e.g. full-bleed
   *  rows that need their dividers to reach the card edge). Conflicting padding
   *  utilities resolve by stylesheet order, not class order, so this has to be a
   *  prop rather than an override in className. */
  padded?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border border-border bg-card ${padded ? "p-5" : ""} ${className}`}
    >
      {children}
    </div>
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

/** Small filled chip for pace / participation breakdowns. `size="sm"` is the
 *  compact form the university cards pack three-across. */
export function StatChip({
  value,
  label,
  tone = "default",
  size = "md",
}: {
  value: ReactNode;
  label: ReactNode;
  tone?: StatChipTone;
  size?: "md" | "sm";
}) {
  const small = size === "sm";
  return (
    <div
      className={`rounded-xl border border-border ${STAT_CHIP_BG_CLASS[tone]} ${
        small ? "min-w-0 px-2 py-[7px]" : "min-w-[130px] px-4 py-3"
      }`}
    >
      <div
        className={`font-extrabold ${STAT_CHIP_VALUE_CLASS[tone]} ${small ? "text-[15px]" : "text-xl"}`}
      >
        {value}
      </div>
      <div className={`mt-0.5 text-muted ${small ? "text-[9px]" : "text-[11.5px]"}`}>{label}</div>
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

type HeroTone = "purple" | "green" | "black" | "yellow";
const HERO_TONE_CLASS: Record<HeroTone, string> = {
  purple: "bg-linear-to-br from-purple to-purple-dark text-white",
  green: "bg-linear-to-br from-green to-green-dark text-white",
  black: "bg-linear-to-br from-surface-dark-soft to-surface-dark text-white",
  yellow: "bg-linear-to-br from-yellow-light to-yellow-dark text-surface-dark",
};

/**
 * Gradient headline number. `size="lg"` is the full-width banner the ecosystem
 * view opens each section with; `size="mini"` is the stacked tile used four-across
 * above a summary table.
 */
export function HeroStat({
  value,
  label,
  tone = "purple",
  size = "lg",
}: {
  value: ReactNode;
  label: ReactNode;
  tone?: HeroTone;
  size?: "lg" | "mini";
}) {
  const mini = size === "mini";
  return (
    <div
      className={`mb-1.5 rounded-2xl ${HERO_TONE_CLASS[tone]} ${
        mini ? "flex flex-col items-start gap-0.5 px-[18px] py-4" : "flex items-baseline gap-4 px-[26px] py-4"
      }`}
    >
      <span className={`font-display font-extrabold leading-none ${mini ? "text-[28px]" : "text-[44px]"}`}>
        {value}
      </span>
      <span className={mini ? "text-[11.5px] font-semibold opacity-90" : "text-[13px] font-bold"}>
        {label}
      </span>
    </div>
  );
}

type ChipTone = "black" | "green" | "purple" | "yellow" | "ghost";
const CHIP_TONE_CLASS: Record<ChipTone, string> = {
  black: "bg-surface-dark text-white border-black",
  green: "bg-green text-white border-green-dark",
  purple: "bg-purple text-white border-purple-dark",
  yellow: "bg-yellow text-surface-dark border-yellow-dark",
  ghost: "bg-card text-ink border-border shadow-none",
};

export interface FilterChip {
  label: ReactNode;
  tone?: ChipTone;
  /** Present once chips become real filter links; until then they render as text. */
  href?: string;
}

/**
 * The per-section scope chips ("Cohort: all", "Semester: 2026-1").
 *
 * These report the filters already applied from the top bar rather than holding
 * their own state — a chip that looked interactive but did nothing, or that
 * disagreed with the top bar about scope, would be worse than a plain label.
 */
export function FilterChipRow({
  chips,
  className = "",
}: {
  chips: FilterChip[];
  className?: string;
}) {
  if (chips.length === 0) return null;
  return (
    <div className={`mb-4 flex flex-wrap gap-2.5 ${className}`}>
      {chips.map((c, i) => (
        <span
          key={i}
          className={`inline-flex items-center rounded-[10px] border-2 px-4 py-2 text-xs font-extrabold tracking-[0.2px] shadow-sm ${
            CHIP_TONE_CLASS[c.tone ?? "ghost"]
          }`}
        >
          {c.label}
        </span>
      ))}
    </div>
  );
}

/** Country heading with a colored rule, used to group the ecosystem cards. */
export function CountryGroupTitle({
  children,
  tone = "purple",
}: {
  children: ReactNode;
  tone?: "purple" | "green";
}) {
  return (
    <div className="mb-2.5 mt-4 flex items-center gap-2.5 text-[13.5px] font-extrabold text-surface-dark">
      <span
        className={`inline-block h-[17px] w-1 rounded-sm ${tone === "green" ? "bg-green" : "bg-purple"}`}
      />
      {children}
    </div>
  );
}

/**
 * Small classifying tag. Generic rather than a public/private badge because the
 * design reuses the same treatment for operator tracks (Early Support / Growth &
 * Development).
 */
export function TypeBadge({
  children,
  tone = "lavender",
}: {
  children: ReactNode;
  tone?: "lavender" | "mint";
}) {
  return (
    <span
      className={`ml-2 inline-block rounded-md px-2.5 py-[3px] align-middle text-[10px] font-extrabold uppercase tracking-[0.3px] ${
        tone === "mint" ? "bg-mint text-green-dark" : "bg-lavender text-purple"
      }`}
    >
      {children}
    </span>
  );
}
