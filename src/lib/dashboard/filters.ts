// Parse Next.js searchParams into validated DashboardFilters.
import { Country, ProgramStatus, RiskLevel } from "../../generated/prisma/enums";
import { parseSemester } from "./semester";
import type { DashboardFilters } from "./types";

export type SearchParams = Record<string, string | string[] | undefined>;

const first = (v: string | string[] | undefined): string | undefined =>
  (Array.isArray(v) ? v[0] : v) || undefined;

function asEnum<T extends string>(values: Record<string, T>, v: string | undefined): T | undefined {
  return v && Object.values(values).includes(v as T) ? (v as T) : undefined;
}

export function parseFilters(sp: SearchParams): DashboardFilters {
  const period = first(sp.period);
  const semester = first(sp.semester);
  return {
    country: asEnum(Country, first(sp.country)),
    cohort: first(sp.cohort),
    university: first(sp.university),
    gender: first(sp.gender),
    department: first(sp.department),
    programStatus: asEnum(ProgramStatus, first(sp.status)),
    riskLevel: asEnum(RiskLevel, first(sp.risk)),
    period: period && /^\d{4}-\d{2}$/.test(period) ? period : undefined,
    semester: semester && parseSemester(semester) ? semester : undefined,
  };
}

/**
 * Build a query string that preserves the current search params (so filters survive a
 * redirect or tab switch) with the given overrides applied on top. Used by the
 * deprecated-route redirect stubs. Pure/testable.
 */
export function preserveParams(sp: SearchParams, overrides: Record<string, string> = {}): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(sp)) {
    const v = first(value);
    if (v) params.set(key, v);
  }
  for (const [key, value] of Object.entries(overrides)) params.set(key, value);
  return params.toString();
}

export type FilterKey =
  | "country"
  | "cohort"
  | "university"
  | "status"
  | "risk"
  | "period"
  | "department"
  | "semester";

/**
 * Which TopFilters pills a given dashboard route should show. Per the Phase B indicator
 * spec: most views only need cohort/country/university; Home also gets a department
 * pill (for its department breakdown); Scholar Profile puts university first (its
 * search matches on university name too). Out-of-scope routes (unit-economics,
 * selection-pipeline, admin/**) keep today's full pill set.
 */
export function visiblePillsForPath(pathname: string): FilterKey[] {
  if (pathname === "/dashboard") return ["cohort", "country", "university", "department"];
  if (pathname.startsWith("/dashboard/early-support")) {
    return ["cohort", "country", "university", "semester"];
  }
  if (pathname.startsWith("/dashboard/career-readiness")) return ["cohort", "country", "university"];
  if (pathname.startsWith("/dashboard/actors")) return ["cohort", "country", "university"];
  if (pathname.startsWith("/dashboard/scholars")) {
    return ["university", "country", "cohort", "status", "risk"];
  }
  return ["country", "cohort", "university", "status", "risk", "period"];
}

/** The colour each filter reads as in the per-section filter controls. Pinned so a given
 *  filter looks the same on every view — the design file is inconsistent about this and
 *  the app should not inherit that. */
export const FILTER_CHIP_TONE: Record<
  FilterKey,
  "black" | "green" | "purple" | "yellow" | "ghost"
> = {
  cohort: "black",
  country: "green",
  risk: "purple",
  period: "yellow",
  university: "ghost",
  department: "ghost",
  status: "ghost",
  semester: "yellow",
};

export const FILTER_CHIP_LABEL: Record<FilterKey, string> = {
  cohort: "Cohort",
  country: "Country",
  university: "University",
  status: "Status",
  risk: "Risk",
  period: "Month",
  department: "Department",
  semester: "Semester",
};

/**
 * Block-level filters (SPEC-004). Each dashboard section that renders its own filter row owns a
 * namespace here; the listed keys are the dimensions that section exposes. A block value overrides
 * the page's global filter for that block only — an unset one inherits the global value, so the
 * default state means "whatever the page is scoped to".
 *
 * Adding a section's filter row to the dashboard means adding it here: the reset rule, the URL
 * param names and the per-block Clear all derive from this registry.
 */
export const BLOCK_FILTERS = {
  ourScholars: ["cohort", "country", "university"],
  dropOuts: ["cohort", "country", "university"],
  programRetention: ["cohort", "country", "university"],
  earlySupportStatus: ["cohort", "country", "university"],
} as const satisfies Record<string, readonly FilterKey[]>;

export type BlockId = keyof typeof BLOCK_FILTERS;

/** URL param for one block dimension, e.g. ("ourScholars", "country") -> "ourScholarsCountry".
 *  Namespacing by block is what keeps two sections filtering the same dimension independent. */
export function blockParamName(block: BlockId, key: FilterKey): string {
  return `${block}${key.charAt(0).toUpperCase()}${key.slice(1)}`;
}

/** Every block param across every page. Stripped from the URL whenever a global filter changes
 *  (see TopFilters.setParam), so a page-level scope change always resets block-level state rather
 *  than leaving it stale against the new scope. Params for other pages simply aren't present. */
export const ALL_BLOCK_FILTER_PARAMS: string[] = Object.entries(BLOCK_FILTERS).flatMap(
  ([block, keys]) => keys.map((key) => blockParamName(block as BlockId, key)),
);

/** Read one block's overrides off the URL. Only the dimensions that block exposes are read, so a
 *  stray param belonging to another block can never bleed into this one. */
export function parseBlockFilters(sp: SearchParams, block: BlockId): Partial<DashboardFilters> {
  const keys: readonly FilterKey[] = BLOCK_FILTERS[block];
  const overrides: Partial<DashboardFilters> = {};
  for (const key of keys) {
    const raw = first(sp[blockParamName(block, key)]);
    if (!raw) continue;
    if (key === "country") overrides.country = asEnum(Country, raw);
    else if (key === "cohort") overrides.cohort = raw;
    else if (key === "university") overrides.university = raw;
  }
  return overrides;
}

/**
 * Layer a block's overrides over the page's global filters. Defined block values win; undefined
 * ones fall through to the global value, so an unset block control never blanks an inherited
 * global scope. Feed the result to that block's queries so every card in it reads one population.
 */
export function applyBlockFilters(
  filters: DashboardFilters,
  overrides: Partial<DashboardFilters>,
): DashboardFilters {
  const defined = Object.fromEntries(
    Object.entries(overrides).filter(([, value]) => value !== undefined),
  );
  return { ...filters, ...defined };
}

/** Clear one block's params, leaving global filters and every sibling block untouched. */
export function clearBlockFilters(currentQuery: string, block: BlockId): URLSearchParams {
  const params = new URLSearchParams(currentQuery);
  for (const key of BLOCK_FILTERS[block]) params.delete(blockParamName(block, key));
  return params;
}

/**
 * Apply a single filter-param change to a query string. Pass `resetBlockFilters: true` for a
 * GLOBAL filter change (TopFilters) so every block-level filter on the page resets with it;
 * omit it for a block filter's own change, which must never touch global or sibling state.
 * Pure and DOM-free so the reset rule is unit-testable without a component/router harness.
 */
export function applyFilterParamChange(
  currentQuery: string,
  key: string,
  value: string,
  options: { resetBlockFilters?: boolean } = {},
): URLSearchParams {
  const params = new URLSearchParams(currentQuery);
  if (value) params.set(key, value);
  else params.delete(key);
  if (options.resetBlockFilters) {
    for (const blockParam of ALL_BLOCK_FILTER_PARAMS) params.delete(blockParam);
  }
  return params;
}

/** The value a filter key currently resolves to, or undefined when unset. Block filter controls
 *  read this off the GLOBAL filters to label their inherit option, so an unset block control
 *  reports the scope its block is actually on rather than claiming "all". */
export function filterValueOf(filters: DashboardFilters, key: FilterKey): string | undefined {
  const valueOf: Record<FilterKey, string | undefined> = {
    cohort: filters.cohort,
    country: filters.country,
    university: filters.university,
    status: filters.programStatus,
    risk: filters.riskLevel,
    period: filters.period,
    department: filters.department,
    semester: filters.semester,
  };
  return valueOf[key];
}
