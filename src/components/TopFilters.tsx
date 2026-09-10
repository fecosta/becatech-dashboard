"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { FilterSelect } from "@/components/FilterSelect";
import { applyFilterParamChange, visiblePillsForPath } from "@/lib/dashboard/filters";
import {
  COUNTRY_LABEL,
  PROGRAM_STATUS_LABEL,
  RISK_LEVEL_LABEL,
  RISK_LEVEL_ORDER,
} from "@/lib/labels";

export interface FilterOptions {
  cohorts: string[];
  universities: string[];
  periods: string[];
  departments: string[];
  semesters: string[];
}

export function TopFilters({ options }: { options: FilterOptions }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const visible = visiblePillsForPath(pathname);
  const val = (key: string) => searchParams.get(key) ?? "";
  const anyActive = visible.some((k) => searchParams.get(k));

  function setParam(key: string, value: string) {
    // A global filter changing resets every block-level filter on the page (SPEC-004) — a
    // no-op on pages with no block filter keys in the URL to begin with.
    const params = applyFilterParamChange(searchParams.toString(), key, value, {
      resetBlockFilters: true,
    });
    router.push(params.toString() ? `${pathname}?${params.toString()}` : pathname);
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {visible.includes("country") ? (
        <FilterSelect
          value={val("country")}
          onChange={(v) => setParam("country", v)}
          emptyLabel="Country: all"
          options={[
            { value: "COLOMBIA", label: COUNTRY_LABEL.COLOMBIA },
            { value: "PERU", label: COUNTRY_LABEL.PERU },
          ]}
        />
      ) : null}
      {visible.includes("cohort") ? (
        <FilterSelect
          value={val("cohort")}
          onChange={(v) => setParam("cohort", v)}
          emptyLabel="Cohort: all"
          options={options.cohorts.map((c) => ({ value: c, label: c }))}
        />
      ) : null}
      {visible.includes("university") ? (
        <FilterSelect
          value={val("university")}
          onChange={(v) => setParam("university", v)}
          emptyLabel="University: all"
          options={options.universities.map((u) => ({ value: u, label: u }))}
        />
      ) : null}
      {visible.includes("department") ? (
        <FilterSelect
          value={val("department")}
          onChange={(v) => setParam("department", v)}
          emptyLabel="Department: all"
          options={options.departments.map((d) => ({ value: d, label: d }))}
        />
      ) : null}
      {visible.includes("status") ? (
        <FilterSelect
          value={val("status")}
          onChange={(v) => setParam("status", v)}
          emptyLabel="Status: all"
          options={Object.entries(PROGRAM_STATUS_LABEL).map(([value, label]) => ({ value, label }))}
        />
      ) : null}
      {visible.includes("risk") ? (
        <FilterSelect
          value={val("risk")}
          onChange={(v) => setParam("risk", v)}
          emptyLabel="Risk: all"
          options={RISK_LEVEL_ORDER.map((r) => ({ value: r, label: RISK_LEVEL_LABEL[r] }))}
        />
      ) : null}
      {visible.includes("period") ? (
        <FilterSelect
          value={val("period")}
          onChange={(v) => setParam("period", v)}
          emptyLabel="Period: all"
          options={options.periods.map((p) => ({ value: p, label: p }))}
        />
      ) : null}
      {visible.includes("semester") ? (
        <FilterSelect
          value={val("semester")}
          onChange={(v) => setParam("semester", v)}
          emptyLabel="Semester: all"
          options={options.semesters.map((s) => ({ value: s, label: s }))}
        />
      ) : null}
      {anyActive ? (
        <button
          onClick={() => router.push(pathname)}
          className="text-xs font-medium text-muted underline hover:text-ink"
        >
          Clear
        </button>
      ) : null}
    </div>
  );
}
