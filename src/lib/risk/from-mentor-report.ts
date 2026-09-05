// Derive the authoritative risk classification from a mentor report.
//
// The MENTOR REPORTS sheet computes a per-report GLOBAL STATUS (col Y) from the mentor's academic
// and psychosocial status — the same value the program's official dashboard counts. We already sync
// it into `MentorReport.mentorReportedGlobalStatus`; here we map it (verbatim, never re-derived)
// into a RiskAssessment keyed by the program month (MES n). The academic/psychosocial axes are
// stored as supporting detail; participation is tracked separately (from the activity counts) and
// is not part of the sheet's global classification, so it stays a non-driver here.
import type { Prisma } from "../../generated/prisma/client";
import { parseRiskClassification } from "./classification";
import { computeAlertType, riskValueFromLevel } from "./risk";

/**
 * Canonicalize a mentor report's month to a program-month key ("MES 1".."MES 6"), or null when it
 * isn't one. Tolerant of case/spacing ("mes 6", "MES  6" → "MES 6") so a scholar-month never splits
 * into two periods.
 */
export function programMonthKey(month: string | null | undefined): string | null {
  const m = /^mes\s*(\d+)$/i.exec(String(month ?? "").trim());
  return m ? `MES ${Number(m[1])}` : null;
}

/**
 * Map a built MentorReport create-input to a RiskAssessment create-input, or `null` when the report
 * carries no usable classification: a blank/unrecognized GLOBAL STATUS, or no reporting month at
 * all, means the scholar-month is simply unclassified (not counted).
 *
 * The period is the report's month: a canonical "MES n" when it's a program-month label, otherwise
 * the month value as-is (some sheets report a calendar month like "2026-03"). Either keys risk fine.
 *
 * `semester` (see docs/adr/008-risk-period-identity.md) is carried through when the report has one,
 * but is deliberately NOT part of this function's null-guard: MentorReport.semester is an optional
 * sheet column with no working calendar-window fallback for any semester past 2026-1 (see
 * src/lib/program-calendar.ts), so refusing to classify a scholar-month over a missing semester
 * would silently drop it from every risk dashboard instead of merely leaving it unable to
 * disambiguate against another semester's same-numbered month -- a strictly worse failure mode
 * than the collision this field exists to fix.
 */
export function mentorReportToRisk(
  r: Prisma.MentorReportUncheckedCreateInput,
): Prisma.RiskAssessmentUncheckedCreateInput | null {
  const global = parseRiskClassification(r.mentorReportedGlobalStatus ?? null);
  const rawMonth = typeof r.reportingMonth === "string" ? r.reportingMonth.trim() : "";
  const period = programMonthKey(rawMonth) ?? (rawMonth || null);
  if (!global || !period) return null;

  const semester = typeof r.semester === "string" ? r.semester.trim() || null : null;
  const academic = parseRiskClassification(r.academicStatus ?? null);
  const psychosocial = parseRiskClassification(r.psychosocialStatus ?? null);
  const academicValue = academic ? riskValueFromLevel(academic) : null;
  const psychosocialValue = psychosocial ? riskValueFromLevel(psychosocial) : null;

  return {
    scholarId: r.scholarId,
    period,
    semester,
    globalRiskLevel: global,
    globalRiskValue: riskValueFromLevel(global),
    academicRiskLevel: academic ?? "SIN_RIESGO",
    academicRiskValue: academicValue ?? 0,
    psychosocialRiskLevel: psychosocial ?? "SIN_RIESGO",
    psychosocialRiskValue: psychosocialValue ?? 0,
    participationRiskLevel: "SIN_RIESGO",
    participationRiskValue: 0,
    assessmentComplete: true,
    missingInputs: [],
    // The driver is the academic/psychosocial axis at the max; participation is not part of the
    // sheet's global classification, so it is never a driver here.
    alertType: computeAlertType(academicValue, psychosocialValue, null),
    country: r.country ?? null,
    cohort: r.cohort ?? null,
    university: r.university ?? null,
    source: "mentor-report",
  };
}
