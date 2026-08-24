import { describe, expect, it } from "vitest";
import {
  atomSeverity,
  categorizeAlertAtom,
  DELIBERATELY_UNMAPPED,
  KNOWN_ATOM_KEYS,
  normalizeAlertAtom,
  splitAlertAtoms,
} from "@/lib/risk/reason-taxonomy";

// The exact option strings the source uses, transcribed from the mentor-report export.
// This list is the contract: when the sheet's dropdown changes, this test is what tells
// us the taxonomy has drifted rather than the UI quietly growing an "unclassified" pile.
const ACADEMIC_ATOMS = [
  "BAJO: Presenta 1 parcial o examen con nota desaprobatoria.",
  "BAJO: Está teniendo dificultades para entender 1 asignaturas.",
  "BAJO: Tiene dificultades en hábitos y métodos de estudio.",
  "BAJO: No obtuvo el promedio requerido en el semestre anterior.",
  "MEDIO: Está teniendo dificultades para entender más de 1 asignatura.",
  "MEDIO: Perdió parciales cruciales en dos o más materias.",
  "MEDIO: Calificaciones parciales bajas que lo ponen en riesgo de reprobar.",
  "MEDIO: Está perdiendo una asignatura/curso.",
  "MEDIO: Está perdiendiendo más de 1 asignatura/curso.",
  "MEDIO: Reprobó 1 o 2 asignaturas de cálculo/math el semestre anterior.",
  "MEDIO: No tiene buenos métodos ni hábitos de estudio.",
  "MEDIO: Canceló/retiró más de 1 asignatura.",
  "MEDIO: Retiró/canceló 1 o 2 materias clave el semestre anterior.",
  "MEDIO: No está asistiendo a tutorías estando en riesgo.",
  "ALTO: Pierde dos o más materias/cursos.",
  "ALTO: Retiró/canceló 1 o 2 materias clave.",
  "ALTO: En riesgo de no obtener el promedio requerido (programa).",
  "ALTO: Inasistencia a las actividades de acompañamiento.",
  "ALTO: Está en riesgo real de perder el semestre.",
  "ALTO: No asiste a clases de dos o más materias.",
  "ALTO: Incumplió una falta en la universidad.",
];

const PSYCHOSOCIAL_ATOMS = [
  "BAJO: Estrés académico ocasional.",
  "BAJO: Duda ocasional sobre sus capacidades académicas.",
  "BAJO: Se ha sentido triste, ansioso/a o desmotivado/a en los últimos días.",
  "BAJO: Desacuerdos familiares o relacionales.",
  "MEDIO: Desorganización persistente o procrastinación que afecta el rendimiento.",
  "MEDIO: Mantiene bajo estado de ánimo o ansiedad por más de dos semanas (afecta su desempeño).",
  "MEDIO: Dificultades económicas que generan preocupación constante (afecta su desempeño).",
  "MEDIO: Conflictos recurrentes con familia o pareja (afecta su desempeño)",
  "MEDIO: Muestra desinterés o dudas frecuentes sobre la beca o carrera(afecta su desempeño).",
  "MEDIO: Aislamiento social progresivo (afecta su desempeño).",
  "ALTO: Crisis emocional que afecta directamente el desempeño académico.",
  "ALTO: En proceso de duelo (pérdida, ruptura significativa).",
  "ALTO: Desmotivación fuerte frente a la carrera o universidad.",
  "ALTO: Ha dejado de realizar actividades sociales o familiares.",
  "ALTO: Ha dejado de realizar actividades académicas por asuntos emocionales.",
  "ALTO: Está considerando abandonar la carrera.",
];

describe("splitAlertAtoms", () => {
  it("splits a two-option cell", () => {
    const raw =
      "BAJO: Presenta 1 parcial o examen con nota desaprobatoria.\nBAJO: Tiene dificultades en hábitos y métodos de estudio.";
    expect(splitAlertAtoms(raw)).toHaveLength(2);
  });

  it("treats SIN ALERTA as no reason at all", () => {
    expect(splitAlertAtoms("SIN ALERTA")).toEqual([]);
    expect(splitAlertAtoms("")).toEqual([]);
    expect(splitAlertAtoms(null)).toEqual([]);
  });
});

describe("normalizeAlertAtom", () => {
  it("strips the severity prefix, accents and case", () => {
    expect(normalizeAlertAtom("ALTO: Pierde dos o más materias/cursos.")).toBe(
      "pierde dos o mas materias/cursos",
    );
  });

  // The source contains this option both with and without its trailing period. Without
  // folding them, one reason would be counted as two.
  it("folds the trailing period so the same option is one key", () => {
    expect(normalizeAlertAtom("ALTO: Pierde dos o más materias/cursos.")).toBe(
      normalizeAlertAtom("ALTO: Pierde dos o más materias/cursos"),
    );
  });
});

describe("atomSeverity", () => {
  // This is the mentor's severity for the option, not the scholar's global risk tier —
  // "BAJO:" options routinely appear on medium and high-risk reports.
  it("reads the prefix, and is null when there is none", () => {
    expect(atomSeverity("ALTO: Pierde dos o más materias/cursos.")).toBe("ALTO");
    expect(atomSeverity("Pierde dos o más materias/cursos.")).toBeNull();
  });
});

describe("categorizeAlertAtom", () => {
  it("maps representative options on each axis", () => {
    expect(categorizeAlertAtom("ALTO: Pierde dos o más materias/cursos.", "academic")).toBe(
      "ACADEMIC_PERFORMANCE",
    );
    expect(
      categorizeAlertAtom("BAJO: Tiene dificultades en hábitos y métodos de estudio.", "academic"),
    ).toBe("STUDY_HABITS");
    expect(categorizeAlertAtom("ALTO: Retiró/canceló 1 o 2 materias clave.", "academic")).toBe(
      "COURSE_WITHDRAWAL",
    );
    expect(categorizeAlertAtom("BAJO: Estrés académico ocasional.", "psychosocial")).toBe(
      "EMOTIONAL_WELLBEING",
    );
    expect(categorizeAlertAtom("BAJO: Desacuerdos familiares o relacionales.", "psychosocial")).toBe(
      "SOCIOECONOMIC_AND_RELATIONSHIPS",
    );
    expect(
      categorizeAlertAtom("ALTO: Está considerando abandonar la carrera.", "psychosocial"),
    ).toBe("MOTIVATION_AND_DIRECTION");
  });

  it("keeps the axes separate — an academic option is not categorized as psychosocial", () => {
    expect(categorizeAlertAtom("ALTO: Pierde dos o más materias/cursos.", "psychosocial")).toBeNull();
  });

  it("returns null for an option nobody has classified yet", () => {
    expect(categorizeAlertAtom("ALTO: Algo completamente nuevo.", "academic")).toBeNull();
  });
});

describe("the taxonomy covers every option the source actually uses", () => {
  it("classifies every academic option, or lists it as deliberately unmapped", () => {
    const unclassified = ACADEMIC_ATOMS.filter(
      (a) =>
        categorizeAlertAtom(a, "academic") === null &&
        !DELIBERATELY_UNMAPPED.includes(normalizeAlertAtom(a)),
    );
    expect(unclassified).toEqual([]);
  });

  it("classifies every psychosocial option, or lists it as deliberately unmapped", () => {
    const unclassified = PSYCHOSOCIAL_ATOMS.filter(
      (a) =>
        categorizeAlertAtom(a, "psychosocial") === null &&
        !DELIBERATELY_UNMAPPED.includes(normalizeAlertAtom(a)),
    );
    expect(unclassified).toEqual([]);
  });

  it("has no mapping entry that no source option matches", () => {
    const academicKeys = new Set(ACADEMIC_ATOMS.map(normalizeAlertAtom));
    const psychosocialKeys = new Set(PSYCHOSOCIAL_ATOMS.map(normalizeAlertAtom));
    expect(KNOWN_ATOM_KEYS.academic.filter((k) => !academicKeys.has(k))).toEqual([]);
    expect(KNOWN_ATOM_KEYS.psychosocial.filter((k) => !psychosocialKeys.has(k))).toEqual([]);
  });
});
