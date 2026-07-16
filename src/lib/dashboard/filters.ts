// Parse Next.js searchParams into validated DashboardFilters.
import { Country, ProgramStatus, RiskLevel } from "../../generated/prisma/enums";
import type { DashboardFilters } from "./types";

export type SearchParams = Record<string, string | string[] | undefined>;

const first = (v: string | string[] | undefined): string | undefined =>
  (Array.isArray(v) ? v[0] : v) || undefined;

function asEnum<T extends string>(values: Record<string, T>, v: string | undefined): T | undefined {
  return v && Object.values(values).includes(v as T) ? (v as T) : undefined;
}

export function parseFilters(sp: SearchParams): DashboardFilters {
  const period = first(sp.period);
  return {
    country: asEnum(Country, first(sp.country)),
    cohort: first(sp.cohort),
    university: first(sp.university),
    gender: first(sp.gender),
    department: first(sp.department),
    programStatus: asEnum(ProgramStatus, first(sp.status)),
    riskLevel: asEnum(RiskLevel, first(sp.risk)),
    period: period && /^\d{4}-\d{2}$/.test(period) ? period : undefined,
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
