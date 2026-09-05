// Field schema for the "MENTOR REPORTS" source — a flat, one-row-per-session sheet whose real
// header sits below a decorative summary block. Alias groups mirror exactly what
// adapters/mentor-reports.ts already reads (its `getAny`/`findByIncludesAny` calls); the
// `ignored` list mirrors apps-script/Normalize.gs's `MENTOR_REPORT_UNMAPPED_HEADERS_`.
import type { SourceContract } from "../types";

export const mentorReportsContract: SourceContract = {
  required: [
    // Either identity signal is enough — the old sheet has no real scholar-ID column at all (its
    // "Número de ID" is the mentor's own ID), the new sheet adds a genuine direct scholar ID.
    // validate.ts is what actually cross-checks/resolves these; this is only "is some identity
    // column present at all".
    // "scholar'name" (missing the S, no space) is the live sheet's actual header text for what
    // was meant to be "Scholar's Name" — confirmed from production, not a guess.
    ["numero de id", "id of the scholar", "nombre del becario", "scholar's name", "scholar'name"],
    ["submission id"],
  ],
  optional: [
    // "mentor' s name" (stray space before the S) is the live sheet's actual header text.
    ["soy:", "mentor's name", "mentor' s name"],
    ["semester"],
    ["pais", "country"],
    ["cohorte del programa:", "cohort"],
    ["universidad", "university"],
    ["¿que mes reportas?"],
    ["fecha de registro"],
    ["fecha", "date of the session"],
    ["sesion:", "session"],
    ["resumen de lo tratado en la sesion", "resume"],
    ["modalidad del espacio"],
    ["~identifica senales que puedan poner en riesgo", "~riesgo de permanencia"],
    ["estado academico", "academic status"],
    // Shared textual pattern for both academic and psychosocial alert-type questions — the
    // adapter disambiguates them by column occurrence (0th vs 1st), which is a mapping detail,
    // not a schema-drift concern; this group only reports "is that question present at all".
    ["~situacion especifica"],
    ["numero de asignaturas/cursos aprobados"],
    ["~numero de asignaturas/cursos en riesgo"],
    ["~asignaturas con dificultades"],
    ["estado psicosocial", "psychosocial status"],
    ["~plan de acompanamiento"],
    ["~tiempo estimado del acompanamiento"],
    ["tutorias individuales"],
    ["tutorias grupales"],
    ["mentorias individuales"],
    ["mentorias grupales"],
    ["talleres grupales"],
    ["~algo destacado"],
    ["~avance academico del becario"],
    ["~de inicio:"],
    ["global status"],
  ],
  ignored: [
    // Verbatim from apps-script/Normalize.gs's MENTOR_REPORT_UNMAPPED_HEADERS_ (see that file for
    // the full rationale per group).
    "mentor id",
    "month", "date", "mes",
    "academic cause", "psychosocial cause",
    "cuentanos cual es el plan y la fecha de inicio (materias rezagadas — plan 1)",
    "escribe que materias estan rezagadas, semestre y numero de veces cursadas",
    "cuentanos cual es el plan y la fecha de inicio (plan 2 — creditos/intersemestral)",
    "escribe que materias estan rezagadas, semestre y numero de veces cursadas, ejemplo para ponerlo: (calculo, primer semestre, segunda vez).",
    "cuentanos cual es el plan y la fecha de inicio, ejemplo: (calculo, intersemestral en 2026-2; fisica, creditos adicionales en 2026-2...)",
    "¿participo en actividades?",
  ],
};
