// Multi-tab dispatcher for a raw "LEGACY_WIDE_EXCEL" upload/sync payload. Each of the three
// operational tabs self-detects its own shape via its own adapter — SCHOLAR GENERAL INFO
// (./scholar-general-info), MENTOR REPORTS (./mentor-reports), SUPPORT ACTIVITY LOG
// (./legacy-support-activity) — so a single upload (or sync call) handles whichever of the three
// it's given with no explicit entity/tab parameter. The per-tab field-mapping logic itself lives
// in those adapter modules now (see docs/adr/007-spreadsheet-source-adapters.md); this file only
// dispatches between them.
import type { ParsedSheet } from "../parse";
import type { CanonicalBatch, CanonicalRow } from "../types";
import { isSupportActivityLogSheet, supportActivityLogLegacyAdapter } from "./legacy-support-activity";
import { isMentorReportsSheet, mentorReportsLegacyAdapter } from "./mentor-reports";
import { isGeneralInfoSheet, scholarGeneralInfoAdapter } from "./scholar-general-info";
import { mapCountry } from "./shared";

export { isGeneralInfoSheet, mapCountry };

export function legacyAdapter(sheets: ParsedSheet[]): CanonicalBatch {
  const scholars: CanonicalRow[] = [];
  const terms: CanonicalRow[] = [];
  const mentorReports: CanonicalRow[] = [];
  const supportActivities: CanonicalRow[] = [];

  for (const sheet of sheets) {
    if (scholarGeneralInfoAdapter.canHandle(sheet)) {
      const adapted = scholarGeneralInfoAdapter.adapt(sheet);
      if (adapted.SCHOLAR) scholars.push(...adapted.SCHOLAR);
      if (adapted.ACADEMIC_TERM) terms.push(...adapted.ACADEMIC_TERM);
    } else if (isMentorReportsSheet(sheet)) {
      mentorReports.push(...mentorReportsLegacyAdapter(sheet));
    } else if (isSupportActivityLogSheet(sheet)) {
      supportActivities.push(...supportActivityLogLegacyAdapter(sheet));
    }
  }

  const batch: CanonicalBatch = {};
  if (scholars.length > 0) batch.SCHOLAR = scholars;
  if (terms.length > 0) batch.ACADEMIC_TERM = terms;
  if (mentorReports.length > 0) batch.MENTOR_REPORT = mentorReports;
  if (supportActivities.length > 0) batch.SUPPORT_ACTIVITY = supportActivities;
  return batch;
}
