// Country-aware GPA aggregation. Colombia (0–5) and Peru (0–20) use different native GPA scales
// and must NEVER be blended into one raw mean — doing so produced a meaningless "average GPA"
// mislabeled "/5" on several dashboard pages. This module is the single source of truth for
// summarizing GPA across a mixed-country scholar set: it reports each country on its own native
// scale, plus an optional country-agnostic "Academic Performance Index" (percentage of each
// scholar's own country maximum) for the case where a single combined KPI is unavoidable.
import type { Country } from "../../generated/prisma/enums";
import { GPA_SCALE_MAX } from "./gpa-bucket";

export interface CountryGpaStat {
  /** Average on the country's native scale, rounded to 2 decimals; null when no valid GPA. */
  average: number | null;
  /** The country's native GPA maximum (5 for Colombia, 20 for Peru). */
  scale: number;
  /** Count of scholars with a valid GPA on this scale. */
  count: number;
}

export interface GpaSummary {
  colombia: CountryGpaStat;
  peru: CountryGpaStat;
  /** Mean of each valid scholar's (gpa / countryMax), as a 0–100 percentage rounded to 1 decimal.
   *  This is a scale-agnostic performance index, NOT an average GPA — never label it "/5" or
   *  "Average GPA". null when no scholar has a valid GPA. */
  normalizedOverallPercentage: number | null;
}

export interface GpaRow {
  gpa: number | null | undefined;
  country: Country;
}

const round = (n: number, digits: number): number => {
  const f = 10 ** digits;
  return Math.round(n * f) / f;
};

/** A GPA is valid only if it's a finite number within [0, the country's native maximum]. Anything
 *  else (null, NaN, negative, or above the scale — e.g. a Colombia 0–5 value of 6, or a mis-scaled
 *  entry) is treated as "no valid GPA" and excluded from every average, never silently clamped. */
function isValidGpa(gpa: number | null | undefined, country: Country): boolean {
  return typeof gpa === "number" && Number.isFinite(gpa) && gpa >= 0 && gpa <= GPA_SCALE_MAX[country];
}

export function summarizeGpa(rows: GpaRow[]): GpaSummary {
  const byCountry: Record<Country, number[]> = { COLOMBIA: [], PERU: [] };
  const fractions: number[] = [];

  for (const { gpa, country } of rows) {
    if (!isValidGpa(gpa, country)) continue;
    byCountry[country].push(gpa as number);
    fractions.push((gpa as number) / GPA_SCALE_MAX[country]);
  }

  const stat = (country: Country): CountryGpaStat => {
    const vals = byCountry[country];
    return {
      average: vals.length ? round(vals.reduce((a, b) => a + b, 0) / vals.length, 2) : null,
      scale: GPA_SCALE_MAX[country],
      count: vals.length,
    };
  };

  return {
    colombia: stat("COLOMBIA"),
    peru: stat("PERU"),
    normalizedOverallPercentage: fractions.length
      ? round((fractions.reduce((a, b) => a + b, 0) / fractions.length) * 100, 1)
      : null,
  };
}

/** Render-ready, English single-KPI display for a GPA summary, honoring the country-scale rule:
 *  - only Colombia in scope → the Colombia average on its /5 scale
 *  - only Peru in scope → the Peru average on its /20 scale
 *  - both countries in scope → the scale-agnostic "Academic Performance Index" (percentage),
 *    never a blended "Average GPA" and never a "/5" label
 *  - no data → an em dash empty state. */
export function gpaSummaryKpi(summary: GpaSummary): { label: string; value: string } {
  const hasCo = summary.colombia.count > 0;
  const hasPe = summary.peru.count > 0;

  if (hasCo && hasPe) {
    return {
      label: "Academic Performance Index",
      value: summary.normalizedOverallPercentage == null ? "—" : `${summary.normalizedOverallPercentage}%`,
    };
  }
  if (hasCo) {
    return { label: "Average GPA · Colombia", value: `${summary.colombia.average?.toFixed(2)}/5` };
  }
  if (hasPe) {
    return { label: "Average GPA · Peru", value: `${summary.peru.average?.toFixed(2)}/20` };
  }
  return { label: "Average GPA", value: "—" };
}
