// Legacy wide-Excel adapter. Normalizes the "SCHOLAR GENERAL INFO" tab — one row per
// scholar with repeating per-term columns (GPA 2024-1, CRÉDITOS 2024-1, …) — into
// SCHOLAR + ACADEMIC_TERM canonical rows. Term columns are detected by regex, so new
// semesters are picked up automatically with no code change.
//
// Also dispatches, per sheet, to the MENTOR REPORTS and SUPPORT ACTIVITY LOG adapters — each
// self-detects its own tab from its header shape, the same way this adapter self-detects
// SCHOLAR GENERAL INFO — so a single LEGACY_WIDE_EXCEL upload (or sync call) handles whichever
// of the three tabs it's given with no explicit entity/tab parameter.
import * as XLSX from "xlsx";
import { coerceValue } from "../coerce";
import type { ParsedSheet } from "../parse";
import type { CanonicalBatch, CanonicalRow, FieldType, RawRecord } from "../types";
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
      gender: c(getByKeyPrefix(idx, "genero"), "string"),
      programStatus: mapStatus(idx.get("estado actual")),
      currentSemester: c(idx.get("semester") ?? idx.get("semestre"), "int"),
      startDate: c(idx.get("fecha de inicio"), "date"),
      expectedEndDate: c(idx.get("fecha de finalizacion"), "date"),
    },
  };
}

function generalInfoRows(
  records: RawRecord[],
  rowNumberOffset = 0,
): { scholars: CanonicalRow[]; terms: CanonicalRow[] } {
  const scholars: CanonicalRow[] = [];
  const terms: CanonicalRow[] = [];

  let blankSkipped = 0;
  records.forEach((rec, i) => {
    const rowNumber = rowNumberOffset + i + 2;
    const idx = indexRecord(rec);
    const scholarId = coerceValue(idx.get("id") ?? idx.get("id_becario"), "string");
    if (typeof scholarId !== "string" || scholarId === "") {
      blankSkipped += 1;
      return; // skip blank rows
    }

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

  // TEMP diagnostic (counts only, no PII) — remove once the production sync issue is resolved.
  console.log(
    `[sync-debug] generalInfoRows: records=${records.length} blankSkipped=${blankSkipped} scholars=${scholars.length} terms=${terms.length}`,
  );

  return { scholars, terms };
}

export function legacyAdapter(sheets: ParsedSheet[]): CanonicalBatch {
  const scholars: CanonicalRow[] = [];
  const terms: CanonicalRow[] = [];
  const mentorReports: CanonicalRow[] = [];
  const supportActivities: CanonicalRow[] = [];

  for (const sheet of sheets) {
    if (isGeneralInfoSheet(sheet.records)) {
      // TEMP diagnostic — remove once the production sync issue is resolved.
      console.log(`[sync-debug] "${sheet.sheetName}": matched isGeneralInfoSheet directly (row 1 header)`);
      const rows = generalInfoRows(sheet.records);
      scholars.push(...rows.scholars);
      terms.push(...rows.terms);
      continue;
    }

    const reAnchored = findGeneralInfoRecords(sheet);
    if (reAnchored) {
      // TEMP diagnostic — remove once the production sync issue is resolved.
      console.log(
        `[sync-debug] "${sheet.sheetName}": matched via header fallback at row index ${reAnchored.headerRowIndex}, records=${reAnchored.records.length}`,
      );
      const rows = generalInfoRows(reAnchored.records, reAnchored.headerRowIndex);
      scholars.push(...rows.scholars);
      terms.push(...rows.terms);
    } else if (isMentorReportsSheet(sheet)) {
      mentorReports.push(...mentorReportsLegacyAdapter(sheet));
    } else if (isSupportActivityLogSheet(sheet)) {
      supportActivities.push(...supportActivityLogLegacyAdapter(sheet));
    } else {
      // TEMP diagnostic — remove once the production sync issue is resolved.
      console.log(`[sync-debug] "${sheet.sheetName}": matched NONE of the 3 known tab formats`);
    }
  }

  const batch: CanonicalBatch = {};
  if (scholars.length > 0) batch.SCHOLAR = scholars;
  if (terms.length > 0) batch.ACADEMIC_TERM = terms;
  if (mentorReports.length > 0) batch.MENTOR_REPORT = mentorReports;
  if (supportActivities.length > 0) batch.SUPPORT_ACTIVITY = supportActivities;
  return batch;
}
