// Derive the three risk dimensions (0–4) from a scholar's underlying data.
// DEFAULT HEURISTIC — documented and meant to be tuned with the program team.
// Pure functions (no I/O); the DB-backed recompute lives in ./recompute.ts.
//
// Assumptions about label semantics (from the seed / JotForm conventions):
//   - check-in finalStatus: "Estable" | "Requiere seguimiento" | "En riesgo"
//   - mentor permanenceRisk: "Bajo" | "Medio" | "Alto"
//   - mentor psychosocialStatus: "Estable" | "En observación" | "En riesgo"
import type { AcademicProgressStatus } from "../../generated/prisma/enums";

const clamp = (n: number): number => Math.max(0, Math.min(4, Math.round(n)));

/** Strip accents + lowercase for tolerant keyword matching on Spanish labels. */
const norm = (s: string | null | undefined): string =>
  (s ?? "").normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

export interface AcademicInputs {
  gpa?: number | null;
  failedSubjectsCount?: number | null;
  expectedProgressStatus?: AcademicProgressStatus | null;
}

const PROGRESS_BAND: Record<AcademicProgressStatus, number> = {
  ON_TRACK: 0,
  SLIGHTLY_BEHIND: 1,
  BEHIND: 2,
  CRITICAL_DELAY: 3,
};

export function deriveAcademicRiskValue(a: AcademicInputs): number {
  const gpaBand =
    a.gpa == null ? 0 : a.gpa >= 4 ? 0 : a.gpa >= 3.5 ? 1 : a.gpa >= 3 ? 2 : a.gpa >= 2.5 ? 3 : 4;
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

export function derivePsychosocialRiskValue(p: PsychosocialInputs): number {
  const status = norm(p.checkinFinalStatus);
  const checkinBand = status.includes("riesgo") ? 3 : status.includes("seguimiento") ? 2 : 0;

  const perm = norm(p.mentorPermanenceRisk);
  const permBand = perm.includes("alto") ? 3 : perm.includes("medio") ? 2 : 0;

  const ps = norm(p.mentorPsychosocialStatus);
  const psBand = ps.includes("riesgo") ? 3 : ps.includes("observacion") ? 2 : 0;

  return clamp(Math.max(checkinBand, permBand, psBand));
}

/** Fewer support activities in the period ⇒ higher participation risk. */
export function deriveParticipationRiskValue(totalActivities: number): number {
  if (totalActivities >= 6) return 0;
  if (totalActivities >= 4) return 1;
  if (totalActivities >= 2) return 2;
  if (totalActivities >= 1) return 3;
  return 4;
}
