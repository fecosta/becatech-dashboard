"use client";

// The dashboard's only filter select. Two skins, one control: the global top bar uses `bar`, and
// the per-section block filters use `chip`, which reproduces the scope chips those filters replaced
// (SPEC-004) — same tone per filter key, so a section looks unchanged but is now interactive.
import type { ChipTone } from "@/components/chip-tone";
import { CHIP_TONE_CLASS } from "@/components/chip-tone";

const BAR_CLASS =
  "max-w-[12rem] rounded-md border border-border bg-card px-2 py-1 text-xs text-ink shadow-sm focus:border-purple focus:outline-none";

const CHIP_CLASS =
  "max-w-[14rem] appearance-none rounded-[10px] border-2 py-2 pl-4 pr-8 text-xs font-extrabold tracking-[0.2px] shadow-sm focus:outline-none";

export interface FilterSelectOption {
  value: string;
  label: string;
}

export function FilterSelect({
  value,
  onChange,
  /** Label for the sentinel option; block filters pass the inherited scope so an unset control
   *  reports what its block is actually showing rather than claiming "all". */
  emptyLabel,
  options,
  variant = "bar",
  tone = "ghost",
}: {
  value: string;
  onChange: (v: string) => void;
  emptyLabel: string;
  options: FilterSelectOption[];
  variant?: "bar" | "chip";
  tone?: ChipTone;
}) {
  const select = (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={variant === "chip" ? `${CHIP_CLASS} ${CHIP_TONE_CLASS[tone]}` : BAR_CLASS}
    >
      <option value="">{emptyLabel}</option>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );

  // `appearance-none` drops the native arrow, so the chip skin draws the mockup's caret itself.
  if (variant !== "chip") return select;
  return (
    <span className="relative inline-flex items-center">
      {select}
      <span aria-hidden className="pointer-events-none absolute right-3 text-xs font-extrabold">
        ⌄
      </span>
    </span>
  );
}
