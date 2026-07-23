// Program-stage split (Beca Tech+ Early Support vs. Career Readiness).
//
// DOCUMENTED, TUNABLE DEFAULT — pending program-team sign-off. The program has no
// explicit `programStage` field; we derive the stage from `Scholar.currentSemester`
// on the assumption of ~2 semesters/year:
//   semesters 1–4  -> Years 1–2 (Early Support)
//   semesters 5+   -> Years 3–5 (Career Readiness)
// Adjust YEARS_1_2_MAX_SEMESTER if a cohort's semester system doesn't map cleanly.
// Scholars with a null currentSemester fall outside BOTH bands (a data-quality gap,
// surfaced rather than guessed).
export const YEARS_1_2_MAX_SEMESTER = 4;

export type ProgramStage = "YEARS_1_2" | "YEARS_3_5";

/** Derive the program stage from a scholar's current semester; null when unknown. */
export function programStageFromSemester(
  currentSemester: number | null | undefined,
): ProgramStage | null {
  if (currentSemester == null) return null;
  return currentSemester <= YEARS_1_2_MAX_SEMESTER ? "YEARS_1_2" : "YEARS_3_5";
}
