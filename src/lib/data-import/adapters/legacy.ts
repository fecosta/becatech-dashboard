// Legacy wide-Excel adapter. Normalizes the "SCHOLAR GENERAL INFO" tab — one row per
// scholar with repeating per-term columns (GPA 2024-1, CRÉDITOS 2024-1, …) — into
// SCHOLAR + ACADEMIC_TERM canonical rows. Term columns are detected by regex, so new
// semesters are picked up automatically with no code change.
//
// Scope note: the per-month ACOMPAÑAMIENTO support-activity block (two-row merged header)
// and the other long tabs are out of scope here — import those via the template path.
import { coerceValue } from "../coerce";
import type { ParsedSheet } from "../parse";
import type { CanonicalBatch, CanonicalRow, FieldType } from "../types";

const TERM = String.raw`(\d{4}-\d)`;
const RE = {
  gpa: new RegExp(`^gpa ${TERM}$`),
  credits: new RegExp(`^creditos ${TERM}$`),
  enrollment: new RegExp(`^estado matricula ${TERM}$`),
  failed: new RegExp(`^materias reprobadas.*${TERM}$`),
};

/** Strip accents, lowercase, collapse whitespace. */
function normKey(k: string): string {
  return k
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function indexRecord(rec: Record<string, unknown>): Map<string, unknown> {
  const idx = new Map<string, unknown>();
  for (const [k, v] of Object.entries(rec)) idx.set(normKey(k), v);
  return idx;
}

function mapCountry(v: unknown): string | undefined {
  const s = normKey(String(v ?? ""));
  if (!s) return undefined;
  if (s.startsWith("col")) return "COLOMBIA";
  if (s.startsWith("per")) return "PERU";
  return String(v).trim();
}

function mapStatus(v: unknown): string | undefined {
  const s = normKey(String(v ?? ""));
  if (!s) return undefined;
  if (s.startsWith("activ")) return "ACTIVE";
  if (s.startsWith("retir") || s.startsWith("desert")) return "WITHDRAWN";
  if (s.startsWith("gradu")) return "GRADUATED";
  if (s.startsWith("paus")) return "PAUSED";
  return String(v).trim();
}

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

export function legacyAdapter(sheets: ParsedSheet[]): CanonicalBatch {
  const scholars: CanonicalRow[] = [];
  const terms: CanonicalRow[] = [];

  for (const sheet of sheets) {
    if (!isGeneralInfoSheet(sheet.records)) continue;

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
  }

  const batch: CanonicalBatch = {};
  if (scholars.length > 0) batch.SCHOLAR = scholars;
  if (terms.length > 0) batch.ACADEMIC_TERM = terms;
  return batch;
}
