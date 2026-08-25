// Why scholars are at risk (AUGUST 4, Early Support §2.2).
//
// MentorReport.academicAlertType and psychosocialAlertType already carry this: they are
// synced from the two "¿Qué situación específica está presentando el becario?" columns
// (apps-script/Normalize.gs, and legacy-mentor-reports.ts). Each cell is a multi-select
// of at most two options, newline separated, each prefixed with a severity word.
//
// The source options are granular — 21 academic, 16 psychosocial — while the design
// reports seven higher-level reasons. This module holds that grouping.
//
// Three things this cannot decide on its own, and does not pretend to:
//
//  1. The severity prefix on an option is NOT the scholar's risk tier. Plenty of
//     "BAJO:" options appear on reports whose global status is medium or high.
//  2. The two axes overlap heavily — roughly two thirds of at-risk scholars are flagged
//     on both. The design shows them as a clean split summing to the at-risk total;
//     ours cannot, so each axis reports its own denominator and a scholar may appear in
//     both tables. A "primary reason" rule would need program sign-off.
//  3. A handful of options do not clearly belong to one reason. Those stay unmapped and
//     surface as a visible count rather than being pushed into a neighbouring bucket.
//
// Owner: the program team. Add options here when the sheet's dropdown changes — the
// exhaustiveness test in tests/risk/reason-taxonomy.test.ts fails when it drifts.

export type RiskAxis = "academic" | "psychosocial";

export type RiskReasonCategory =
  | "ACADEMIC_PERFORMANCE"
  | "STUDY_HABITS"
  | "ACADEMIC_ENGAGEMENT"
  | "COURSE_WITHDRAWAL"
  | "EMOTIONAL_WELLBEING"
  | "SOCIOECONOMIC_AND_RELATIONSHIPS"
  | "MOTIVATION_AND_DIRECTION";

export const RISK_REASON_LABEL: Record<RiskReasonCategory, string> = {
  ACADEMIC_PERFORMANCE: "Academic performance and learning difficulties",
  STUDY_HABITS: "Study habits and self-regulation",
  ACADEMIC_ENGAGEMENT: "Commitment to the academic process",
  COURSE_WITHDRAWAL: "Dropping or withdrawing from courses",
  EMOTIONAL_WELLBEING: "Emotional wellbeing and mental health",
  SOCIOECONOMIC_AND_RELATIONSHIPS: "Socioeconomic context and personal relationships",
  MOTIVATION_AND_DIRECTION: "Motivation and academic direction",
};

export const CATEGORIES_BY_AXIS: Record<RiskAxis, RiskReasonCategory[]> = {
  academic: [
    "ACADEMIC_PERFORMANCE",
    "STUDY_HABITS",
    "ACADEMIC_ENGAGEMENT",
    "COURSE_WITHDRAWAL",
  ],
  psychosocial: [
    "EMOTIONAL_WELLBEING",
    "SOCIOECONOMIC_AND_RELATIONSHIPS",
    "MOTIVATION_AND_DIRECTION",
  ],
};

/** Split a multi-select cell into its options. "SIN ALERTA" means no reason at all. */
export function splitAlertAtoms(raw: string | null | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(/\r?\n/)
    .map((a) => a.trim())
    .filter((a) => a.length > 0 && normalizeAlertAtom(a) !== "sin alerta");
}

/**
 * Lookup key for one option: strip the severity prefix, accents, case and the trailing
 * period. The period matters — the source contains the same option both with and
 * without it, which would otherwise count as two different reasons.
 */
export function normalizeAlertAtom(atom: string): string {
  return atom
    .replace(/^\s*(BAJO|MEDIO|ALTO|CR[ÍI]TICO)\s*:\s*/i, "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[.\s]+$/g, "")
    .trim();
}

/** The severity the mentor picked for this option — reported by the sheet, not the
 *  scholar's global risk tier. */
export function atomSeverity(atom: string): "BAJO" | "MEDIO" | "ALTO" | null {
  const match = atom.match(/^\s*(BAJO|MEDIO|ALTO)\s*:/i);
  return match ? (match[1].toUpperCase() as "BAJO" | "MEDIO" | "ALTO") : null;
}

// Keys are already normalized. Source typos ("perdiendiendo") are kept verbatim as keys
// rather than corrected — the sheet is the source of truth for its own wording.
const ACADEMIC_CATEGORY: Record<string, RiskReasonCategory> = {
  "presenta 1 parcial o examen con nota desaprobatoria": "ACADEMIC_PERFORMANCE",
  "esta teniendo dificultades para entender 1 asignaturas": "ACADEMIC_PERFORMANCE",
  "esta teniendo dificultades para entender mas de 1 asignatura": "ACADEMIC_PERFORMANCE",
  "perdio parciales cruciales en dos o mas materias": "ACADEMIC_PERFORMANCE",
  "calificaciones parciales bajas que lo ponen en riesgo de reprobar": "ACADEMIC_PERFORMANCE",
  "esta perdiendo una asignatura/curso": "ACADEMIC_PERFORMANCE",
  "esta perdiendiendo mas de 1 asignatura/curso": "ACADEMIC_PERFORMANCE",
  "pierde dos o mas materias/cursos": "ACADEMIC_PERFORMANCE",
  "reprobo 1 o 2 asignaturas de calculo/math el semestre anterior": "ACADEMIC_PERFORMANCE",
  "en riesgo de no obtener el promedio requerido (programa)": "ACADEMIC_PERFORMANCE",
  "esta en riesgo real de perder el semestre": "ACADEMIC_PERFORMANCE",
  "no obtuvo el promedio requerido en el semestre anterior": "ACADEMIC_PERFORMANCE",

  "tiene dificultades en habitos y metodos de estudio": "STUDY_HABITS",
  "no tiene buenos metodos ni habitos de estudio": "STUDY_HABITS",

  "inasistencia a las actividades de acompanamiento": "ACADEMIC_ENGAGEMENT",
  "no asiste a clases de dos o mas materias": "ACADEMIC_ENGAGEMENT",
  "no esta asistiendo a tutorias estando en riesgo": "ACADEMIC_ENGAGEMENT",

  "retiro/cancelo 1 o 2 materias clave": "COURSE_WITHDRAWAL",
  "cancelo/retiro mas de 1 asignatura": "COURSE_WITHDRAWAL",
  "retiro/cancelo 1 o 2 materias clave el semestre anterior": "COURSE_WITHDRAWAL",
};

const PSYCHOSOCIAL_CATEGORY: Record<string, RiskReasonCategory> = {
  "estres academico ocasional": "EMOTIONAL_WELLBEING",
  "se ha sentido triste, ansioso/a o desmotivado/a en los ultimos dias": "EMOTIONAL_WELLBEING",
  "mantiene bajo estado de animo o ansiedad por mas de dos semanas (afecta su desempeno)":
    "EMOTIONAL_WELLBEING",
  "crisis emocional que afecta directamente el desempeno academico": "EMOTIONAL_WELLBEING",
  "en proceso de duelo (perdida, ruptura significativa)": "EMOTIONAL_WELLBEING",
  "ha dejado de realizar actividades academicas por asuntos emocionales": "EMOTIONAL_WELLBEING",

  "desacuerdos familiares o relacionales": "SOCIOECONOMIC_AND_RELATIONSHIPS",
  "dificultades economicas que generan preocupacion constante (afecta su desempeno)":
    "SOCIOECONOMIC_AND_RELATIONSHIPS",
  "conflictos recurrentes con familia o pareja (afecta su desempeno)":
    "SOCIOECONOMIC_AND_RELATIONSHIPS",
  "aislamiento social progresivo (afecta su desempeno)": "SOCIOECONOMIC_AND_RELATIONSHIPS",

  "muestra desinteres o dudas frecuentes sobre la beca o carrera(afecta su desempeno)":
    "MOTIVATION_AND_DIRECTION",
  "desmotivacion fuerte frente a la carrera o universidad": "MOTIVATION_AND_DIRECTION",
  "esta considerando abandonar la carrera": "MOTIVATION_AND_DIRECTION",
};

/**
 * Options that exist in the source but do not clearly belong to one reason. Listed
 * explicitly so they read as a decision rather than an oversight, and so the
 * exhaustiveness test can tell "deliberately unmapped" from "newly appeared".
 *
 * - a university disciplinary breach is neither performance nor engagement as the
 *   design defines them
 * - occasional self-doubt could be emotional wellbeing or motivation
 * - persistent disorganisation could be study habits or motivation
 * - withdrawing from social activity could be emotional or interpersonal
 */
export const DELIBERATELY_UNMAPPED: readonly string[] = [
  "incumplio una falta en la universidad",
  "duda ocasional sobre sus capacidades academicas",
  "desorganizacion persistente o procrastinacion que afecta el rendimiento",
  "ha dejado de realizar actividades sociales o familiares",
];

/** The reason an option belongs to, or null when the grouping is not settled. */
export function categorizeAlertAtom(atom: string, axis: RiskAxis): RiskReasonCategory | null {
  const key = normalizeAlertAtom(atom);
  const map = axis === "academic" ? ACADEMIC_CATEGORY : PSYCHOSOCIAL_CATEGORY;
  return map[key] ?? null;
}

/** Every option the taxonomy knows about, for the exhaustiveness test. */
export const KNOWN_ATOM_KEYS: Record<RiskAxis, string[]> = {
  academic: Object.keys(ACADEMIC_CATEGORY),
  psychosocial: Object.keys(PSYCHOSOCIAL_CATEGORY),
};
