// Derive the three risk dimensions (0–4) from a scholar's underlying data.
// DEFAULT HEURISTIC — documented and meant to be tuned with the program team.
// Pure functions (no I/O); the DB-backed recompute lives in ./recompute.ts.
//
// Assumptions about label semantics (from the seed / JotForm conventions):
//   - check-in finalStatus: "Estable" | "Requiere seguimiento" | "En riesgo"
//   - mentor permanenceRisk: "Bajo" | "Medio" | "Alto"
//   - mentor psychosocialStatus: "Estable" | "En observación" | "En riesgo"
import type { AcademicProgressStatus, Country } from "../../generated/prisma/enums";
import { GPA_SCALE_MAX } from "../academic/gpa-bucket";

const clamp = (n: number): number => Math.max(0, Math.min(4, Math.round(n)));

/** Strip accents + lowercase for tolerant keyword matching on Spanish labels. */
const norm = (s: string | null | undefined): string =>
  (s ?? "").normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

export interface AcademicInputs {
  gpa?: number | null;
  failedSubjectsCount?: number | null;
  expectedProgressStatus?: AcademicProgressStatus | null;
  /** Colombia and Peru use different native GPA scales (0-5 vs 0-20) — the GPA band below is
   *  computed as a fraction of the scholar's own country's scale, not an absolute cutoff, so it
   *  needs to know which country this is. Defaults to Colombia's scale if omitted. */
  country?: Country | null;
}

const PROGRESS_BAND: Record<AcademicProgressStatus, number> = {
  ON_TRACK: 0,
  SLIGHTLY_BEHIND: 1,
  BEHIND: 2,
  CRITICAL_DELAY: 3,
};

/**
 * Academic risk (0–4), or null when the scholar has NO academic signal at all (no GPA, no failed-
 * subject count, no expected-progress status) — a "not assessed" dimension, distinct from a real
 * low-risk 0. A present-but-zero value (e.g. failedSubjectsCount = 0) is a real signal, not absence.
 */
export function deriveAcademicRiskValue(a: AcademicInputs): number | null {
  if (a.gpa == null && a.failedSubjectsCount == null && a.expectedProgressStatus == null) {
    return null;
  }
  const scaleMax = a.country ? GPA_SCALE_MAX[a.country] : GPA_SCALE_MAX.COLOMBIA;
  const gpaFraction = a.gpa == null ? null : a.gpa / scaleMax;
  // Thresholds are Colombia's original absolute cutoffs (4/5, 3.5/5, 3/5, 2.5/5) expressed as
  // fractions of the max, so this reproduces Colombia's exact prior behavior unchanged and
  // extends correctly to Peru's 0-20 scale.
  const gpaBand =
    gpaFraction == null
      ? 0
      : gpaFraction >= 0.8
        ? 0
        : gpaFraction >= 0.7
          ? 1
          : gpaFraction >= 0.6
            ? 2
            : gpaFraction >= 0.5
              ? 3
              : 4;
  const failed = a.failedSubjectsCount ?? 0;
  const failedBand = failed <= 0 ? 0 : Math.min(4, failed);
  const progressBand = a.expectedProgressStatus ? PROGRESS_BAND[a.expectedProgressStatus] : 0;
  return clamp(Math.max(gpaBand, failedBand, progressBand));
}

export interface PsychosocialInputs {
  checkinFinalStatus?: string | null;
  mentorPermanenceRisk?: string | null;
  mentorPsychosocialStatus?: string | null;
}

/**
 * Psychosocial risk (0–4), or null when there is NO psychosocial signal at all (no check-in final
 * status and no mentor permanence/psychosocial status) — "not assessed", distinct from a real 0.
 */
export function derivePsychosocialRiskValue(p: PsychosocialInputs): number | null {
  const hasSignal =
    (p.checkinFinalStatus ?? "") !== "" ||
    (p.mentorPermanenceRisk ?? "") !== "" ||
    (p.mentorPsychosocialStatus ?? "") !== "";
  if (!hasSignal) return null;

  const status = norm(p.checkinFinalStatus);
  const checkinBand = status.includes("riesgo") ? 3 : status.includes("seguimiento") ? 2 : 0;

  const perm = norm(p.mentorPermanenceRisk);
  const permBand = perm.includes("alto") ? 3 : perm.includes("medio") ? 2 : 0;

  const ps = norm(p.mentorPsychosocialStatus);
  const psBand = ps.includes("riesgo") ? 3 : ps.includes("observacion") ? 2 : 0;

  return clamp(Math.max(checkinBand, permBand, psBand));
}

/**
 * Fewer support activities in the period ⇒ higher participation risk. Returns null when
 * `totalActivities` is null — i.e. the scholar has NO support-activity rows for the period at all,
 * which is missing data, NOT zero participation. This is the fix for the bug where a scholar with
 * no activity rows was silently scored 0 → 4 → CRITICO. A present zero (an activity row that
 * exists and sums to 0 — the month happened and nothing was attended) is a real 4, not absence.
 */
export function deriveParticipationRiskValue(totalActivities: number | null): number | null {
  if (totalActivities == null) return null;
  if (totalActivities >= 6) return 0;
  if (totalActivities >= 4) return 1;
  if (totalActivities >= 2) return 2;
  if (totalActivities >= 1) return 3;
  return 4;
}
