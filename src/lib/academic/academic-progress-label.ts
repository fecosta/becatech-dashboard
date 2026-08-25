// "On track / Behind / Critical" from Scholar.academicProgress (AUGUST 4 §8.1 and the
// per-stage Academic Progress blocks).
//
// Two independent sources describe the same idea and they are not interchangeable:
//
//  - Scholar.academicProgress — a label the program computes and the sheet carries.
//    Synced today, but read by no query, which is why this module exists.
//  - AcademicTerm.expectedProgressStatus — derived from credit progress. NOT emitted by
//    the sheet sync (see ACADEMIC_TERM_HEADER_ in apps-script/Normalize.gs), so it is
//    populated only by the manual upload template and by the seed.
//
// This reads the first. It is a controlled list: an unrecognized value surfaces as
// UNKNOWN rather than being folded into a bucket it might not belong to.
import { normalizeSourceValue } from "../display/source-values";

export type ScholarProgressLabel =
  | "ON_TRACK"
  | "BEHIND"
  | "CRITICAL"
  | "PENDING"
  | "NOT_APPLICABLE"
  | "UNKNOWN";

const BY_VALUE: Record<string, ScholarProgressLabel> = {
  satisfactorio: "ON_TRACK",
  "al dia": "ON_TRACK",
  rezagado: "BEHIND",
  critico: "CRITICAL",
  "pendiente de info": "PENDING",
  pendiente: "PENDING",
  pending: "PENDING",
  "not applicable": "NOT_APPLICABLE",
  "no aplica": "NOT_APPLICABLE",
};

export function parseScholarProgress(raw: string | null | undefined): ScholarProgressLabel {
  const key = normalizeSourceValue(raw ?? "");
  if (!key) return "PENDING";
  return BY_VALUE[key] ?? "UNKNOWN";
}

export const PROGRESS_LABEL: Record<"ON_TRACK" | "BEHIND" | "CRITICAL", string> = {
  ON_TRACK: "On track",
  BEHIND: "Behind",
  CRITICAL: "Critical",
};
