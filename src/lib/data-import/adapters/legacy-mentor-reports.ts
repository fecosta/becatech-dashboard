// Legacy wide-Excel adapter for the "MENTOR REPORTS" tab — flat, one row per mentor session,
// already carrying a Submission ID column (unlike SCHOLAR GENERAL INFO / SUPPORT ACTIVITY LOG,
// there is no repeating-period block to pivot here). The real header sits a few rows below a
// decorative mini pivot-table summary, so it's located dynamically instead of assuming row 1.
import * as XLSX from "xlsx";
import { coerceValue } from "../coerce";
import type { ParsedSheet } from "../parse";
import type { CanonicalRow, FieldType } from "../types";
import { indexRecord, mapCountry, normKey } from "./shared";

const HEADER_SCAN_LIMIT = 20;

/** The sheet's own starting row (0-based) — usually 0, but never assume it. */
function sheetStartRow(sheet: ParsedSheet): number {
  const ref = sheet.sheet?.["!ref"];
  return ref ? XLSX.utils.decode_range(ref).s.r : 0;
}

function rawRows(sheet: ParsedSheet): unknown[][] {
  if (!sheet.sheet) return [];
  // blankrows:true so array index i always maps to physical row (sheetStartRow(sheet) + i) —
  // needed for findHeaderRowIndex's result to be a valid `range` for sheet_to_json below.
  return XLSX.utils.sheet_to_json<unknown[]>(sheet.sheet, {
    header: 1,
    defval: null,
    raw: true,
    blankrows: true,
  });
}

/** Physical (0-based) row index of the real header (the row carrying both marker columns), or -1. */
function findHeaderRowIndex(sheet: ParsedSheet): number {
  const rows = rawRows(sheet);
  const limit = Math.min(rows.length, HEADER_SCAN_LIMIT);
  for (let i = 0; i < limit; i++) {
    const keys = (rows[i] ?? []).map(normKey);
    if (keys.includes("numero de id") && keys.includes("submission id")) return sheetStartRow(sheet) + i;
  }
  return -1;
}

/** nth (0-based) value among entries whose normalized key includes `substr`, in column order. */
function findByIncludes(idx: Map<string, unknown>, substr: string, occurrence = 0): unknown {
  let count = 0;
  for (const [k, v] of idx) {
    if (k.includes(substr)) {
      if (count === occurrence) return v;
      count += 1;
    }
  }
  return undefined;
}

export function isMentorReportsSheet(sheet: ParsedSheet): boolean {
  return findHeaderRowIndex(sheet) >= 0;
}

export function mentorReportsLegacyAdapter(sheet: ParsedSheet): CanonicalRow[] {
  const headerRowIndex = findHeaderRowIndex(sheet);
  if (headerRowIndex < 0) return [];

  // Re-parse anchored at the real header row so column names (not the decorative rows above)
  // become the object keys. `sheet.sheet` is defined here — rawRows() above already returned
  // non-empty rows, which requires it.
  const records = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet.sheet!, {
    range: headerRowIndex,
    defval: null,
    raw: true,
    blankrows: false,
  });

  const c = (v: unknown, t: FieldType) => coerceValue(v, t);
  const out: CanonicalRow[] = [];

  records.forEach((rec, i) => {
    const idx = indexRecord(rec);
    const scholarId = c(idx.get("numero de id"), "string");
    if (typeof scholarId !== "string" || scholarId === "") return; // skip blank rows

    out.push({
      rowNumber: headerRowIndex + i + 2, // +1: header row itself, +1: 1-based row numbers
      data: {
        scholarId,
        scholarName: c(idx.get("nombre del becario"), "string"),
        mentorName: c(idx.get("soy:"), "string"),
        country: mapCountry(idx.get("pais")),
        cohort: c(idx.get("cohorte del programa:"), "string"),
        university: c(idx.get("universidad"), "string"),
        reportingMonth: c(idx.get("¿que mes reportas?"), "string"),
        registrationDate: c(idx.get("fecha de registro"), "date"),
        sessionDate: c(idx.get("fecha"), "date"),
        sessionType: c(idx.get("sesion:"), "string"),
        sessionSummary: c(idx.get("resumen de lo tratado en la sesion"), "string"),
        modality: c(idx.get("modalidad del espacio"), "string"),
        permanenceRisk: c(
          findByIncludes(idx, "identifica senales que puedan poner en riesgo"),
          "string",
        ),
        academicStatus: c(idx.get("estado academico"), "string"),
        academicAlertType: c(findByIncludes(idx, "situacion especifica", 0), "string"),
        approvedCoursesCount: c(idx.get("numero de asignaturas/cursos aprobados"), "int"),
        atRiskCoursesCount: c(
          findByIncludes(idx, "numero de asignaturas/cursos en riesgo"),
          "int",
        ),
        difficultSubjects: c(findByIncludes(idx, "asignaturas con dificultades"), "string"),
        psychosocialStatus: c(idx.get("estado psicosocial"), "string"),
        psychosocialAlertType: c(findByIncludes(idx, "situacion especifica", 1), "string"),
        accompanimentPlan: c(findByIncludes(idx, "plan de acompanamiento"), "string"),
        estimatedSupportTime: c(findByIncludes(idx, "tiempo estimado del acompanamiento"), "string"),
        individualTutoring: c(idx.get("tutorias individuales"), "int"),
        groupTutoring: c(idx.get("tutorias grupales"), "int"),
        individualMentoring: c(idx.get("mentorias individuales"), "int"),
        groupMentoring: c(idx.get("mentorias grupales"), "int"),
        workshops: c(idx.get("talleres grupales"), "int"),
        highlights: c(findByIncludes(idx, "algo destacado"), "string"),
        academicProgressNotes: c(findByIncludes(idx, "avance academico del becario"), "string"),
        nextSteps: c(findByIncludes(idx, "de inicio:"), "string"),
        submissionId: c(idx.get("submission id"), "string"),
      },
    });
  });

  return out;
}
