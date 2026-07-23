// Program-year split (Home's "Scholars by Year" breakdown / by-year retention).
//
// DOCUMENTED, TUNABLE DEFAULT — pending program-team sign-off, same rationale as
// program-stage.ts (no explicit "class year" field exists; derived from
// `currentSemester` assuming ~2 semesters/year). Reuses YEARS_1_2_MAX_SEMESTER as the
// Year 2 / Year 3 boundary so this split can never drift out of sync with the Early
// Support / Growth & Development stage split:
//   semesters 1–2  -> Year 1
//   semesters 3–4  -> Year 2 (== YEARS_1_2_MAX_SEMESTER)
//   semesters 5+   -> Year 3
// Scholars with a null currentSemester fall outside all three bands (surfaced, not guessed).
import { YEARS_1_2_MAX_SEMESTER } from "./program-stage";

export const YEAR_1_MAX_SEMESTER = 2;

export type ProgramYear = "YEAR_1" | "YEAR_2" | "YEAR_3";

/** Derive the program year from a scholar's current semester; null when unknown. */
export function programYearFromSemester(
  currentSemester: number | null | undefined,
): ProgramYear | null {
  if (currentSemester == null) return null;
  if (currentSemester <= YEAR_1_MAX_SEMESTER) return "YEAR_1";
  if (currentSemester <= YEARS_1_2_MAX_SEMESTER) return "YEAR_2";
  return "YEAR_3";
}
