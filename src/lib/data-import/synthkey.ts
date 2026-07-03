// Deterministic submissionId for JotForm-sourced rows imported without one, so that
// re-uploading the same data upserts (idempotent) instead of duplicating.
import type { ImportEntity } from "./types";

export function synthSubmissionId(entity: ImportEntity, data: Record<string, unknown>): string {
  const scholarId = String(data.scholarId ?? "");
  switch (entity) {
    case "MONTHLY_CHECKIN":
      return `import:checkin:${scholarId}:${String(data.reportingMonth ?? "")}`;
    case "MENTOR_REPORT":
      return `import:mentor:${scholarId}:${String(data.reportingMonth ?? "")}:${dateKey(data.sessionDate)}`;
    case "SCHOLAR_REQUEST":
      return `import:request:${scholarId}:${dateKey(data.submissionDate)}:${String(data.requestType ?? "")}`;
    default:
      return `import:${entity}:${scholarId}`;
  }
}

function dateKey(v: unknown): string {
  if (v instanceof Date && !Number.isNaN(v.getTime())) return v.toISOString().slice(0, 10);
  return v == null ? "" : String(v);
}
