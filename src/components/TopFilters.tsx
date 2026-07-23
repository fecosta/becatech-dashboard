"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { visiblePillsForPath } from "@/lib/dashboard/filters";
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
}

export function TopFilters({ options }: { options: FilterOptions }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const visible = visiblePillsForPath(pathname);
  const val = (key: string) => searchParams.get(key) ?? "";
  const anyActive = visible.some((k) => searchParams.get(k));

  function setParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    router.push(params.toString() ? `${pathname}?${params.toString()}` : pathname);
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {visible.includes("country") ? (
        <Select
          value={val("country")}
          onChange={(v) => setParam("country", v)}
          placeholder="Country"
          options={[
            { value: "COLOMBIA", label: COUNTRY_LABEL.COLOMBIA },
            { value: "PERU", label: COUNTRY_LABEL.PERU },
          ]}
        />
      ) : null}
      {visible.includes("cohort") ? (
        <Select
          value={val("cohort")}
          onChange={(v) => setParam("cohort", v)}
          placeholder="Cohort"
          options={options.cohorts.map((c) => ({ value: c, label: c }))}
        />
      ) : null}
      {visible.includes("university") ? (
        <Select
          value={val("university")}
          onChange={(v) => setParam("university", v)}
          placeholder="University"
          options={options.universities.map((u) => ({ value: u, label: u }))}
        />
      ) : null}
      {visible.includes("department") ? (
        <Select
          value={val("department")}
          onChange={(v) => setParam("department", v)}
          placeholder="Department"
          options={options.departments.map((d) => ({ value: d, label: d }))}
        />
      ) : null}
      {visible.includes("status") ? (
        <Select
          value={val("status")}
          onChange={(v) => setParam("status", v)}
          placeholder="Status"
          options={Object.entries(PROGRAM_STATUS_LABEL).map(([value, label]) => ({ value, label }))}
        />
      ) : null}
      {visible.includes("risk") ? (
        <Select
          value={val("risk")}
          onChange={(v) => setParam("risk", v)}
          placeholder="Risk"
          options={RISK_LEVEL_ORDER.map((r) => ({ value: r, label: RISK_LEVEL_LABEL[r] }))}
        />
      ) : null}
      {visible.includes("period") ? (
        <Select
          value={val("period")}
          onChange={(v) => setParam("period", v)}
          placeholder="Period"
          options={options.periods.map((p) => ({ value: p, label: p }))}
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

function Select({
  value,
  onChange,
  placeholder,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  options: { value: string; label: string }[];
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="max-w-[12rem] rounded-md border border-border bg-card px-2 py-1 text-xs text-ink shadow-sm focus:border-purple focus:outline-none"
    >
      <option value="">{placeholder}: all</option>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}
