// Source adapter for the "SCHOLAR GENERAL INFO" tab — one row per scholar with repeating
// per-term columns (GPA 2024-1, CRÉDITOS 2024-1, …) — into SCHOLAR + ACADEMIC_TERM canonical
// rows. Term columns are detected by regex (source-contracts/scholar-general-info.ts), so new
// semesters are picked up automatically with no code change. Moved out of adapters/legacy.ts
// (which keeps its role as the multi-tab dispatcher) so this source has its own named, formally-
// contracted module, per docs/adr/007-spreadsheet-source-adapters.md.
import * as XLSX from "xlsx";
import { coerceValue } from "../coerce";
import type { ParsedSheet } from "../parse";
import {
  ENGLISH_LEVEL_PATTERN,
  TERM_PATTERNS as RE,
  scholarGeneralInfoContract,
} from "../source-contracts/scholar-general-info";
import type { CanonicalBatch, CanonicalRow, FieldType, RawRecord, SourceAdapter } from "../types";
import { classifyColumns } from "../validation/drift";
import { getAny, indexRecord, mapCountry, mapStatus, normKey, parseSemesterCell } from "./shared";

// NOTE: unlike apps-script/Normalize.gs (which reads cells positionally via getValues() arrays),
// this adapter goes through XLSX.utils.sheet_to_json, which keys each row by its (normalized)
// header text — duplicate literal header text collapses to one property, silently dropping the
// others. The new sheet's bare "ESTADO FINAL" column repeats identically up to 4 times, so it
// CANNOT be resolved here the way Normalize.gs's findAcademicStatusColumns_ resolves it
// positionally; academicStatus stays unmapped for this (manual-upload) path until this adapter's
// row model is reworked to read positionally too. Flagged, not fixed, in this pass.

/** A general-info header row has an ID column and at least one `GPA <term>` column. */
function looksLikeGeneralInfoHeader(keys: string[]): boolean {
  const hasId = keys.some((k) => k === "id" || k === "id_becario");
  const hasTermGpa = keys.some((k) => RE.gpa.test(k));
  return hasId && hasTermGpa;
}

export function isGeneralInfoSheet(records: Record<string, unknown>[]): boolean {
  const sample = records[0];
  if (!sample) return false;
  return looksLikeGeneralInfoHeader(Object.keys(sample).map(normKey));
}

const HEADER_SCAN_LIMIT = 20;

/**
 * Fallback for a raw export with decorative rows above the real header (e.g. a title row and a
 * block-label row before "ID, PAÍS, COHORTE, ..."), which `isGeneralInfoSheet`'s row-1 check
 * misses. Scans the first ~20 rows for the real header and, if found, returns records re-anchored
 * there plus that header's physical row index (for accurate rowNumber reporting) — same technique
 * as the MENTOR REPORTS adapter's dynamic header detection.
 */
function findGeneralInfoRecords(sheet: ParsedSheet): { records: RawRecord[]; headerRowIndex: number } | null {
  if (!sheet.sheet) return null;
  const rawRows = XLSX.utils.sheet_to_json<unknown[]>(sheet.sheet, {
    header: 1,
    defval: null,
    raw: true,
    blankrows: true,
  });
  const startRow = sheet.sheet["!ref"] ? XLSX.utils.decode_range(sheet.sheet["!ref"]).s.r : 0;
  const limit = Math.min(rawRows.length, HEADER_SCAN_LIMIT);
  for (let i = 0; i < limit; i++) {
    const keys = (rawRows[i] ?? []).map(normKey);
    if (looksLikeGeneralInfoHeader(keys)) {
      const headerRowIndex = startRow + i;
      const records = XLSX.utils.sheet_to_json<RawRecord>(sheet.sheet, {
        range: headerRowIndex,
        defval: null,
        raw: true,
        blankrows: false,
      });
      return { records, headerRowIndex };
    }
  }
  return null;
}

/**
 * First value whose normalized key starts with `prefix`. Needed for columns like "GÉNERO" whose
 * real-export header cell is actually "GÉNERO\n(M o F)" — a merged hint line that normKey folds
 * into "genero (m o f)", not the exact "genero" an equality lookup expects.
 */
function getByKeyPrefix(idx: Map<string, unknown>, prefix: string): unknown {
  for (const [k, v] of idx) {
    if (k.startsWith(prefix)) return v;
  }
  return undefined;
}

/** First value whose normalized key matches `pattern` — used for "English level - <term>", a
 *  current (not per-term) Scholar field whose header nonetheless carries a term suffix. Only one
 *  such column is expected to be populated at a time; if a future sheet adds a second, this takes
 *  whichever is encountered first (not necessarily the latest term) — not solved here. */
function getByKeyPattern(idx: Map<string, unknown>, pattern: RegExp): unknown {
  for (const [k, v] of idx) {
    if (pattern.test(k)) return v;
  }
  return undefined;
}

/** "Overdue Courses" is a literal count of courses currently behind schedule, confirmed from
 *  production. Maps directly onto AcademicTerm.expectedProgressStatus per the program's own
 *  definitions: 0 = on track, exactly 1 = behind (one course behind), 2+ = critical (more than
 *  one course behind). SLIGHTLY_BEHIND (used elsewhere for a ratio-based derivation, see
 *  academic/progress.ts) has no equivalent here — the dashboard already folds it into "Behind"
 *  alongside BEHIND, so this never needing to produce it doesn't lose any UI distinction. */
function progressStatusFromOverdueCourses(overdueCourses: number): string {
  if (overdueCourses <= 0) return "ON_TRACK";
  if (overdueCourses === 1) return "BEHIND";
  return "CRITICAL_DELAY";
}

/** GPA coercion tolerant of a comma decimal separator — confirmed from production: some term-GPA
 *  columns (e.g. 2025-2, 2026-1) use "4,28" while others in the same row use "4.34". Number()
 *  doesn't parse a comma decimal, so it would otherwise silently drop these to null. Only swaps a
 *  comma for a period when there's no period already, so a genuinely period-formatted (or any
 *  other) value is untouched. */
function coerceGpa(v: unknown): number | null {
  const s = typeof v === "string" && v.includes(",") && !v.includes(".") ? v.replace(",", ".") : v;
  return coerceValue(s, "float") as number | null;
}

function scholarRow(idx: Map<string, unknown>, rowNumber: number): CanonicalRow {
  const c = (v: unknown, t: FieldType) => coerceValue(v, t);
  return {
    rowNumber,
    data: {
      scholarId: c(idx.get("id") ?? idx.get("id_becario"), "string"),
      fullName: c(getAny(idx, ["nombre completo", "scholars name"]), "string"),
      country: mapCountry(getAny(idx, ["pais", "country"])),
      cohort: c(getAny(idx, ["cohorte", "cohort"]), "string"),
      university: c(getAny(idx, ["universidad", "university"]), "string"),
      academicProgram: c(getAny(idx, ["programa academico", "academic program"]), "string"),
      gender: c(getByKeyPrefix(idx, "genero") ?? getByKeyPrefix(idx, "gender"), "string"),
      programStatus: mapStatus(getAny(idx, ["estado actual", "current status"])),
      // "current semester" (new sheet) is a distinct exact string, not a substring of
      // "semester"/"semestre" (old sheet) — needs its own alias, not just the ?? fallback.
      // The real sheet's values are ordinal Spanish words ("Sexto semestre"), not plain
      // numbers — parseSemesterCell handles that (never a plain Number()/coerceValue "int").
      currentSemester: parseSemesterCell(getAny(idx, ["semester", "semestre", "current semester"])),
      startDate: c(getAny(idx, ["fecha de inicio", "started date"]), "date"),
      // No new-sheet equivalent exists (only a bare "Estimated Graduation Year") — intentionally
      // left null for new-sheet rows rather than derived from other fields.
      expectedEndDate: c(idx.get("fecha de finalizacion"), "date"),
      // Extended profile fields — present on the real sheet but previously unread by this
      // (manual-upload) adapter path; the TEMPLATE/Normalize.gs sync path already maps these.
      email1: c(idx.get("email 1"), "string"),
      email2: c(idx.get("email 2"), "string"),
      mobilePhone: c(idx.get("mobile phone"), "string"),
      dateOfBirth: c(idx.get("date of birth"), "date"),
      ethnicGroup: c(idx.get("ethnic group"), "string"),
      socioeconomicLevel: c(idx.get("socioeconomic level"), "string"),
      departmentOrigin: c(idx.get("department of origin"), "string"),
      municipalityOrigin: c(idx.get("municipality of origin"), "string"),
      currentDepartment: c(idx.get("current department of residence"), "string"),
      currentMunicipality: c(idx.get("current municipality of residence"), "string"),
      motherEducationLevel: c(idx.get("mother's education level"), "string"),
      fatherEducationLevel: c(idx.get("father's education level"), "string"),
      programDurationYears: c(idx.get("program duration (years)"), "int"),
      estimatedGraduationYear: c(idx.get("estimated graduation year"), "int"),
      highSchoolGraduationYear: c(idx.get("high school graduation year"), "int"),
      academicProgress: c(idx.get("academic progress"), "string"),
      currentEnglishLevel: c(getByKeyPattern(idx, ENGLISH_LEVEL_PATTERN), "string"),
    },
  };
}

export function generalInfoRows(
  records: RawRecord[],
  rowNumberOffset = 0,
): { scholars: CanonicalRow[]; terms: CanonicalRow[] } {
  const scholars: CanonicalRow[] = [];
  const terms: CanonicalRow[] = [];

  records.forEach((rec, i) => {
    const rowNumber = rowNumberOffset + i + 2;
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
      if ((m = RE.gpa.exec(key))) ensure(m[1]).gpa = coerceGpa(value);
      else if ((m = RE.credits.exec(key))) ensure(m[1]).creditsEnrolled = coerceValue(value, "int");
      else if ((m = RE.enrollment.exec(key))) ensure(m[1]).enrollmentStatus = coerceValue(value, "string");
      else if ((m = RE.failed.exec(key))) ensure(m[1]).failedSubjectsCount = coerceValue(value, "int");
      else if ((m = RE.failedDetail.exec(key))) ensure(m[1]).failedSubjectsDetail = coerceValue(value, "string");
    }

    // "Cumulative GPA" and "Overdue Courses" are single columns per scholar, not per-term like the
    // ones above — there's no header suffix saying which term they're "as of". Rather than leave
    // them unmapped (the Academic Progress dashboard section reads exactly these), attach them to
    // the scholar's most recently REPORTED term — the one with the highest term key among those
    // that actually have data — since "cumulative"/"as of now" naturally means "as of the latest
    // term reported", not a blank future one. If no term has any real data yet, they're left
    // unattached rather than guessed onto a blank term. A blank cell still sets its field (to
    // null) via ensure() above, for every term column the header has — so "has this key" isn't
    // "has real data"; a term only counts as reported when some field actually holds a non-null
    // value.
    const reportedTerms = [...byTerm.entries()]
      .filter(([, data]) => Object.entries(data).some(([k, v]) => k !== "scholarId" && k !== "term" && v != null))
      .map(([term]) => term)
      .sort();
    const latestReportedTerm = reportedTerms[reportedTerms.length - 1];
    if (latestReportedTerm) {
      const latest = ensure(latestReportedTerm);
      const accumulatedGpa = coerceGpa(idx.get("cumulative gpa"));
      if (accumulatedGpa != null) latest.accumulatedGpa = accumulatedGpa;
      const overdueCourses = coerceValue(idx.get("overdue courses"), "int") as number | null;
      if (overdueCourses != null) latest.expectedProgressStatus = progressStatusFromOverdueCourses(overdueCourses);
    }

    for (const data of byTerm.values()) terms.push({ rowNumber, data });
  });

  return { scholars, terms };
}

/** Resolve a sheet to its (records, headerRowIndex) for the general-info shape, trying the direct
 *  row-1 header first and falling back to the decorative-rows scan — shared by canHandle/adapt/
 *  inspectSchema so all three agree on which header row this sheet actually has. */
function resolveGeneralInfoSheet(sheet: ParsedSheet): { records: RawRecord[]; headerRowIndex: number } | null {
  if (isGeneralInfoSheet(sheet.records)) return { records: sheet.records, headerRowIndex: 0 };
  return findGeneralInfoRecords(sheet);
}

export const scholarGeneralInfoAdapter: SourceAdapter<ParsedSheet> = {
  source: "SCHOLAR_GENERAL_INFO",
  canHandle: (sheet) => resolveGeneralInfoSheet(sheet) !== null,
  adapt: (sheet) => {
    const resolved = resolveGeneralInfoSheet(sheet);
    if (!resolved) return {};
    const { scholars, terms } = generalInfoRows(resolved.records, resolved.headerRowIndex);
    const batch: CanonicalBatch = {};
    if (scholars.length > 0) batch.SCHOLAR = scholars;
    if (terms.length > 0) batch.ACADEMIC_TERM = terms;
    return batch;
  },
  inspectSchema: (sheet) => {
    const resolved = resolveGeneralInfoSheet(sheet);
    const headerKeys = resolved ? Object.keys(resolved.records[0] ?? {}).map(normKey) : [];
    return classifyColumns(headerKeys, scholarGeneralInfoContract);
  },
};
