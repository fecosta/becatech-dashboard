// "Latest valid graded GPA" — the single definition of a scholar's current GPA.
//
// AcademicTerm carries two GPA columns and they do NOT mean the same thing:
//
//   gpa            the term's own grade. The production Google Sheets sync emits this.
//   accumulatedGpa the scholar's cumulative GPA. Only the admin CSV/XLSX import path
//                  populates it (from the sheet's "Cumulative GPA" column); the
//                  production sync does not.
//
// Dashboard sections that mean "how is this scholar doing now" must read `gpa`, or they
// render empty against production-shaped data while looking fine against seeded demo
// data — the exact failure SPEC-004 §10.1 was raised for. Only genuinely cumulative
// readouts (the scholar profile's "Cumulative GPA" chip and GPA trend) keep reading
// `accumulatedGpa`.
//
// Selecting the right term is not just "the last row". The source stores terms a scholar
// was not enrolled in, and future terms not yet graded, as a literal 0 — so the latest row
// is often an ungraded placeholder sitting on top of the scholar's real latest grade. A 0
// here means "not enrolled / not graded", never "failed", and must not be bucketed as a
// failing GPA (SPEC-004 §10.7).
import type { Country } from "../../generated/prisma/enums";
import { GPA_SCALE_MAX } from "./gpa-bucket";

/** The fields this selector needs from an AcademicTerm row. */
export interface GpaTermRow {
  scholarId: string;
  term: string;
  gpa: number | null;
}

export interface LatestGpaSelection {
  /** scholarId → their latest valid graded GPA, on their own country's native scale. */
  byScholar: Map<string, number>;
  /** Term rows skipped because the source writes "not enrolled / not graded" as 0. */
  excludedZeroGpaCount: number;
}

/**
 * True when `gpa` is a real grade on `country`'s native scale.
 *
 * Deliberately stricter than gpa-summary's `isValidGpa`, which accepts 0: that one
 * averages whatever it is given, while this one decides whether a term was graded at all.
 */
export function isGradedGpa(gpa: number | null | undefined, country: Country): boolean {
  return typeof gpa === "number" && Number.isFinite(gpa) && gpa > 0 && gpa <= GPA_SCALE_MAX[country];
}

/**
 * Pick each scholar's latest valid graded GPA.
 *
 * Invalid rows are never written, so a later ungraded or out-of-range term cannot displace
 * an earlier real grade. Terms may arrive in any order — the winner is decided by comparing
 * the `term` label (the source's "2025-1", "2025-2", … sort correctly as strings), not by
 * the caller's `orderBy`.
 *
 * Scholars with no graded term are simply absent from `byScholar`; callers decide whether
 * that means "excluded" or "not reported" for their own denominator.
 */
export function selectLatestGradedGpa(
  terms: Iterable<GpaTermRow>,
  countryByScholar: ReadonlyMap<string, Country>,
): LatestGpaSelection {
  const best = new Map<string, { term: string; gpa: number }>();
  let excludedZeroGpaCount = 0;

  for (const row of terms) {
    const country = countryByScholar.get(row.scholarId);
    if (!country) continue;
    if (row.gpa === 0) {
      excludedZeroGpaCount += 1;
      continue;
    }
    if (!isGradedGpa(row.gpa, country)) continue;
    const current = best.get(row.scholarId);
    if (!current || row.term >= current.term) {
      best.set(row.scholarId, { term: row.term, gpa: row.gpa as number });
    }
  }

  return {
    byScholar: new Map([...best].map(([scholarId, v]) => [scholarId, v.gpa])),
    excludedZeroGpaCount,
  };
}
