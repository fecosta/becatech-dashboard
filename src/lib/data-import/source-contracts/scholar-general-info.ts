// Field schema for the "SCHOLAR GENERAL INFO" source — the program team's wide, one-row-per-
// scholar sheet with multi-row (category + field) headers. Alias groups mirror exactly what
// adapters/scholar-general-info.ts already reads (its `getAny`/`idx.get` calls); the `ignored`
// list mirrors apps-script/Normalize.gs's `SCHOLAR_UNMAPPED_HEADERS_` (kept in sync manually with
// that file today — the same duplication ADR-007 is about closing, not yet closed by this list).
// Do not add an alias here without a matching read in the adapter, or an entry there without a
// matching reason in Normalize.gs's own list.
import type { SourceContract } from "../types";

/** Term suffix shared by every repeating per-semester column, e.g. "2026-1". Not itself a
 *  capturing group — TERM_PATTERNS wraps it in one where the term needs to be extracted. */
export const TERM_SUFFIX = String.raw`\d{4}-\d`;

/** Repeating per-term header patterns (bilingual), each capturing the term suffix in group 1. A
 *  new semester's columns are recognized automatically — no code change needed when e.g.
 *  "GPA 2027-1" appears. */
export const TERM_PATTERNS = {
  gpa: new RegExp(`^gpa (${TERM_SUFFIX})$`),
  credits: new RegExp(`^(?:creditos|credits) (${TERM_SUFFIX})$`),
  enrollment: new RegExp(`^(?:estado matricula|enrollment status) (${TERM_SUFFIX})$`),
  failed: new RegExp(`^materias reprobadas.*(${TERM_SUFFIX})$`),
  failedDetail: new RegExp(`^mencionar las asignaturas (${TERM_SUFFIX})$`),
};

/** "English level - <term>" (col AY) is a Scholar-level *current* value, not per-term like the
 *  patterns above — only one such column is expected to be populated at a time, so the adapter
 *  reads whichever one exists rather than pivoting it into AcademicTerm rows. */
export const ENGLISH_LEVEL_PATTERN = new RegExp(`^english level - ${TERM_SUFFIX}$`);

export const scholarGeneralInfoContract: SourceContract = {
  required: [
    ["id", "id_becario"],
    ["nombre completo", "scholars name"],
    ["pais", "country"],
    ["cohorte", "cohort"],
    ["universidad", "university"],
    ["programa academico", "academic program"],
    // Prefix match: the real cell is often a merged hint line, e.g. "GÉNERO\n(M o F)" (normalizes
    // to "genero (m o f)"), not a bare "genero" — see getByKeyPrefix in the adapter.
    ["genero*", "gender*"],
  ],
  optional: [
    ["estado actual", "current status"],
    ["semester", "semestre", "current semester"],
    ["fecha de inicio", "started date"],
    ["fecha de finalizacion"],
    ["email 1"],
    ["email 2"],
    ["mobile phone"],
    ["date of birth"],
    ["ethnic group"],
    ["socioeconomic level"],
    ["department of origin"],
    ["municipality of origin"],
    ["current department of residence"],
    ["current municipality of residence"],
    ["mother's education level"],
    ["father's education level"],
    ["program duration (years)"],
    ["estimated graduation year"],
    ["high school graduation year"],
    ["academic progress"],
    // Single-value-per-scholar (not per-term) — attached to the scholar's latest reported term by
    // the adapter (see generalInfoRows), not a guessed/arbitrary term. Deliberately no longer on
    // the ignored list below: the Academic Progress dashboard section reads these.
    ["cumulative gpa"],
    ["overdue courses"],
  ],
  ignored: [
    // Single-value-per-scholar academic-summary fields whose target model (AcademicTerm) is keyed
    // per term — no reliable "which term" to attach them to without guessing. Verbatim from
    // apps-script/Normalize.gs's SCHOLAR_UNMAPPED_HEADERS_ (see that file for the full rationale
    // per group).
    "acumulado", "materias atrasadas", "alternativa de nivelacion", "¿esta nivelando?",
    "plazo maximo", "¿recibio apoyo?", "estado", "total credits", "cumulative - credits",
    // A documented historical header variant (per Normalize.gs's own list) — not present in the
    // current sheet's actual header (confirmed against a real export), kept ignored rather than
    // mapped since there is nothing to map it to today.
    "% de avance - estudios",
    "participatin in english program", "numero de cursos u (requeridos)",
    "nivel requerido por la u", "nivel de inicio", "nivel (marco)", "¿hizo validacion?",
    "cursos obligatorios", "cursos realizados (a la fecha)", "% avance", "nivel actual 2025-2",
    "lb: academico", "icfes col", "notas (puntaje ib - peru)", "lb: socioeconomico", "sisben col",
    "nivel economico (peru)", "nivel de priorizacion", "monto", "observacion", "puntaje seleccion",
    "puntaje", "total de creditos", "gpa acumulado",
    "estado avance (act semestral)", "estado final", "edad", "age",
    "talleres", "sesiones individuales", "tutorias", "psicosocial", "total", "total alertas",
    "resumen alertas", "confident english", "makers",
    "acompanamiento actual",
    // Read by the automated sync's Normalize.gs (which maps this to Scholar.operatorId), but not
    // by this manual-upload adapter today — a pre-existing gap between the two paths, not
    // something this refactor fixes (adding it would be new adapter behavior, not a formalization
    // of existing behavior).
    "current operator - support services",
  ],
  repeating: [...Object.values(TERM_PATTERNS), ENGLISH_LEVEL_PATTERN],
};
