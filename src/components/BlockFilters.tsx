"use client";

// Per-section filter row (SPEC-004). These are the scope chips the sections used to render, now
// interactive: same position, same tone per filter key, but each one sets a block-scoped URL param
// instead of merely reporting the top bar. A block's controls only ever touch that block's own
// params, so they can never disturb a global filter or a sibling section.
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { FilterSelect } from "@/components/FilterSelect";
import {
  applyFilterParamChange,
  BLOCK_FILTERS,
  type BlockId,
  blockParamName,
  clearBlockFilters,
  FILTER_CHIP_LABEL,
  FILTER_CHIP_TONE,
  filterValueOf,
  type FilterKey,
} from "@/lib/dashboard/filters";
import type { DashboardFilters, FilterOptions } from "@/lib/dashboard/types";
import { COUNTRY_LABEL } from "@/lib/labels";

function optionsFor(key: FilterKey, options: FilterOptions): { value: string; label: string }[] {
  if (key === "country") {
    return [
      { value: "COLOMBIA", label: COUNTRY_LABEL.COLOMBIA },
      { value: "PERU", label: COUNTRY_LABEL.PERU },
    ];
  }
  if (key === "cohort") return options.cohorts.map((c) => ({ value: c, label: c }));
  if (key === "university") return options.universities.map((u) => ({ value: u, label: u }));
  if (key === "department") return options.departments.map((d) => ({ value: d, label: d }));
  if (key === "period") return options.periods.map((p) => ({ value: p, label: p }));
  if (key === "semester") return options.semesters.map((s) => ({ value: s, label: s }));
  return [];
}

export function BlockFilters({
  block,
  options,
  globals,
}: {
  block: BlockId;
  options: FilterOptions;
  /** The page's global filters — used only to label the inherit option truthfully. */
  globals: DashboardFilters;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const keys: readonly FilterKey[] = BLOCK_FILTERS[block];
  const anyActive = keys.some((key) => searchParams.get(blockParamName(block, key)));

  function push(params: URLSearchParams) {
    router.push(params.toString() ? `${pathname}?${params.toString()}` : pathname);
  }

  return (
    <div className="mb-4 flex flex-wrap items-center gap-2.5">
      {keys.map((key) => {
        const param = blockParamName(block, key);
        // Unset means "inherit the page scope", so the empty option names the inherited value
        // rather than claiming "all" while the cards below are filtered.
        const inherited = filterValueOf(globals, key) ?? "all";
        // Every option carries the dimension name, so a chip still reads "Cohort: 2024" once
        // something is picked — the self-describing label is the whole point of the chip.
        const label = (text: string) => `${FILTER_CHIP_LABEL[key]}: ${text}`;
        return (
          <FilterSelect
            key={param}
            variant="chip"
            tone={FILTER_CHIP_TONE[key]}
            value={searchParams.get(param) ?? ""}
            emptyLabel={label(inherited)}
            options={optionsFor(key, options).map((o) => ({ ...o, label: label(o.label) }))}
            onChange={(value) =>
              // No resetBlockFilters: a block change must leave globals and siblings alone.
              push(applyFilterParamChange(searchParams.toString(), param, value))
            }
          />
        );
      })}
      {anyActive ? (
        <button
          onClick={() => push(clearBlockFilters(searchParams.toString(), block))}
          className="text-xs font-medium text-muted underline hover:text-ink"
        >
          Clear
        </button>
      ) : null}
    </div>
  );
}
