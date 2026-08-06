// `cohort` is free text (seed uses "2024"/"2025"/"2026"; imports could use other shapes).
// Pick the "latest" with a numeric-aware string compare so "2026" > "2024" and
// "2024-2" > "2024-1" without assuming a fixed 4-digit-year format.
export function latestCohort(cohorts: (string | null | undefined)[]): string | null {
  const cleaned = cohorts
    .map((c) => c?.trim())
    .filter((c): c is string => !!c);
  if (cleaned.length === 0) return null;
  return cleaned.reduce((a, b) => (a.localeCompare(b, undefined, { numeric: true }) >= 0 ? a : b));
}

/**
 * Cohort 2024 is excluded from the program's official risk/retention denominators (per the sheet's
 * `<>Cohorte 2024` filter). Matches any cohort value carrying "2024" ("Cohorte 2024 COL", "2024", …).
 */
export function isCohort2024(cohort: string | null | undefined): boolean {
  return !!cohort && cohort.includes("2024");
}
