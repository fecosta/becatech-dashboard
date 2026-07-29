// Legacy wide-Excel adapter. Normalizes the "SCHOLAR GENERAL INFO" tab — one row per
// scholar with repeating per-term columns (GPA 2024-1, CRÉDITOS 2024-1, …) — into
// SCHOLAR + ACADEMIC_TERM canonical rows. Term columns are detected by regex, so new
// semesters are picked up automatically with no code change.
//
// Also dispatches, per sheet, to the MENTOR REPORTS and SUPPORT ACTIVITY LOG adapters — each
// self-detects its own tab from its header shape, the same way this adapter self-detects
// SCHOLAR GENERAL INFO — so a single LEGACY_WIDE_EXCEL upload (or sync call) handles whichever
// of the three tabs it's given with no explicit entity/tab parameter.
import { coerceValue } from "../coerce";
import type { ParsedSheet } from "../parse";
import type { CanonicalBatch, CanonicalRow, FieldType } from "../types";
import { isMentorReportsSheet, mentorReportsLegacyAdapter } from "./legacy-mentor-reports";
import { isSupportActivityLogSheet, supportActivityLogLegacyAdapter } from "./legacy-support-activity";
import { indexRecord, mapCountry, mapStatus, normKey } from "./shared";

export { mapCountry };

const TERM = String.raw`(\d{4}-\d)`;
const RE = {
  gpa: new RegExp(`^gpa ${TERM}$`),
  credits: new RegExp(`^creditos ${TERM}$`),
  enrollment: new RegExp(`^estado matricula ${TERM}$`),
  failed: new RegExp(`^materias reprobadas.*${TERM}$`),
};

/** A general-info sheet has an ID column and at least one `GPA <term>` column. */
export function isGeneralInfoSheet(records: Record<string, unknown>[]): boolean {
  const sample = records[0];
  if (!sample) return false;
  const keys = Object.keys(sample).map(normKey);
  const hasId = keys.some((k) => k === "id" || k === "id_becario");
  const hasTermGpa = keys.some((k) => RE.gpa.test(k));
  return hasId && hasTermGpa;
}

function scholarRow(idx: Map<string, unknown>, rowNumber: number): CanonicalRow {
  const c = (v: unknown, t: FieldType) => coerceValue(v, t);
  return {
    rowNumber,
    data: {
      scholarId: c(idx.get("id") ?? idx.get("id_becario"), "string"),
      fullName: c(idx.get("nombre completo"), "string"),
      country: mapCountry(idx.get("pais")),
      cohort: c(idx.get("cohorte"), "string"),
      university: c(idx.get("universidad"), "string"),
      academicProgram: c(idx.get("programa academico"), "string"),
      gender: c(idx.get("genero"), "string"),
      programStatus: mapStatus(idx.get("estado actual")),
      currentSemester: c(idx.get("semester") ?? idx.get("semestre"), "int"),
      startDate: c(idx.get("fecha de inicio"), "date"),
      expectedEndDate: c(idx.get("fecha de finalizacion"), "date"),
    },
  };
}

function generalInfoRows(sheet: ParsedSheet): { scholars: CanonicalRow[]; terms: CanonicalRow[] } {
  const scholars: CanonicalRow[] = [];
  const terms: CanonicalRow[] = [];

  sheet.records.forEach((rec, i) => {
    const rowNumber = i + 2;
    const idx = indexRecord(rec);
    const scholarId = coerceValue(idx.get("id") ?? idx.get("id_becario"), "string");
    if (typeof scholarId !== "string" || scholarId === "") return; // skip blank rows

    scholars.push(scholarRow(idx, rowNumber));

    // Collect per-term fields from the repeating wide columns.
    const byTerm = new Map<string, Record<string, unknown>>();
    const ensure = (term: string) => {
      let e = byTerm.get(term);
      if (!e) {
        e = { scholarId, term };
        byTerm.set(term, e);
      }
      return e;
    };
    for (const [key, value] of idx) {
      let m: RegExpExecArray | null;
      if ((m = RE.gpa.exec(key))) ensure(m[1]).gpa = coerceValue(value, "float");
      else if ((m = RE.credits.exec(key))) ensure(m[1]).creditsEnrolled = coerceValue(value, "int");
      else if ((m = RE.enrollment.exec(key))) ensure(m[1]).enrollmentStatus = coerceValue(value, "string");
      else if ((m = RE.failed.exec(key))) ensure(m[1]).failedSubjectsCount = coerceValue(value, "int");
    }
    for (const data of byTerm.values()) terms.push({ rowNumber, data });
  });

  return { scholars, terms };
}

export function legacyAdapter(sheets: ParsedSheet[]): CanonicalBatch {
  const scholars: CanonicalRow[] = [];
  const terms: CanonicalRow[] = [];
  const mentorReports: CanonicalRow[] = [];
  const supportActivities: CanonicalRow[] = [];

  for (const sheet of sheets) {
    if (isGeneralInfoSheet(sheet.records)) {
      const rows = generalInfoRows(sheet);
      scholars.push(...rows.scholars);
      terms.push(...rows.terms);
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
