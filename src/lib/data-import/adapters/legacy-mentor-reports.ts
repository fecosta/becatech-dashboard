// Legacy wide-Excel adapter for the "MENTOR REPORTS" tab — flat, one row per mentor session,
// already carrying a Submission ID column (unlike SCHOLAR GENERAL INFO / SUPPORT ACTIVITY LOG,
// there is no repeating-period block to pivot here). The real header sits a few rows below a
// decorative mini pivot-table summary, so it's located dynamically instead of assuming row 1.
import * as XLSX from "xlsx";
import { coerceValue } from "../coerce";
import type { ParsedSheet } from "../parse";
import type { CanonicalRow, FieldType } from "../types";
import { findByIncludesAny, getAny, indexRecord, mapCountry, normKey } from "./shared";

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

/** Physical (0-based) row index of the real header (the row carrying both marker columns), or -1.
 * Old sheet's anchor: "numero de id" (the mentor's own ID) + "submission id". New sheet's:
 * "id of the scholar" (a real, direct scholar ID this time) + "submission id". */
function findHeaderRowIndex(sheet: ParsedSheet): number {
  const rows = rawRows(sheet);
  const limit = Math.min(rows.length, HEADER_SCAN_LIMIT);
  for (let i = 0; i < limit; i++) {
    const keys = (rows[i] ?? []).map(normKey);
    const hasIdColumn = keys.includes("numero de id") || keys.includes("id of the scholar");
    if (hasIdColumn && keys.includes("submission id")) return sheetStartRow(sheet) + i;
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
    // Old sheet's "Número de ID" (right after "Soy: ", the mentor's own self-identification
    // question) is the MENTOR's ID, not the scholar's — that sheet has no real scholar-ID column
    // at all. The new sheet's "ID OF THE SCHOLAR" is a genuine, direct scholar ID. Both are passed
    // through as-is; validate.ts resolves/cross-checks scholarId against scholarName centrally
    // (never guessing when they disagree) — this adapter stays purely mechanical. A decorative/
    // blank row has neither — skip only when BOTH are blank, so a real row missing just one isn't
    // silently dropped before validation sees it.
    const scholarId = c(getAny(idx, ["numero de id", "id of the scholar"]), "string");
    const scholarName = c(getAny(idx, ["nombre del becario", "scholar's name"]), "string");
    if (!scholarId && !scholarName) return; // skip fully blank rows

    out.push({
      rowNumber: headerRowIndex + i + 2, // +1: header row itself, +1: 1-based row numbers
      data: {
        scholarId,
        scholarName,
        mentorName: c(getAny(idx, ["soy:", "mentor's name"]), "string"),
        semester: c(idx.get("semester"), "string"),
        country: mapCountry(getAny(idx, ["pais", "country"])),
        cohort: c(getAny(idx, ["cohorte del programa:", "cohort"]), "string"),
        university: c(getAny(idx, ["universidad", "university"]), "string"),
        // Old sheet's "¿Qué mes reportas?" is still present verbatim on the new sheet; the new
        // sheet's separate bare "MONTH" column is ambiguous and left unmapped (Task 8).
        reportingMonth: c(idx.get("¿que mes reportas?"), "string"),
        // No new-sheet equivalent (only a bare "DATE" column, meaning unclear — Task 8).
        registrationDate: c(idx.get("fecha de registro"), "date"),
        sessionDate: c(getAny(idx, ["fecha", "date of the session"]), "date"),
        sessionType: c(getAny(idx, ["sesion:", "session"]), "string"),
        sessionSummary: c(getAny(idx, ["resumen de lo tratado en la sesion", "resume"]), "string"),
        modality: c(idx.get("modalidad del espacio"), "string"),
        permanenceRisk: c(
          findByIncludesAny(idx, ["identifica senales que puedan poner en riesgo", "riesgo de permanencia"]),
          "string",
        ),
        academicStatus: c(getAny(idx, ["estado academico", "academic status"]), "string"),
        academicAlertType: c(findByIncludes(idx, "situacion especifica", 0), "string"),
        approvedCoursesCount: c(idx.get("numero de asignaturas/cursos aprobados"), "int"),
        atRiskCoursesCount: c(
          findByIncludes(idx, "numero de asignaturas/cursos en riesgo"),
          "int",
        ),
        difficultSubjects: c(findByIncludes(idx, "asignaturas con dificultades"), "string"),
        psychosocialStatus: c(getAny(idx, ["estado psicosocial", "psychosocial status"]), "string"),
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
        // The new sheet splits this into three separate columns instead of one — concatenate-vs-
        // new-fields is an open question (Task 8); stays mapped only to the old sheet's shape.
        nextSteps: c(findByIncludes(idx, "de inicio:"), "string"),
        mentorReportedGlobalStatus: c(idx.get("global status"), "string"),
        submissionId: c(idx.get("submission id"), "string"),
      },
    });
  });

  return out;
}
