import * as XLSX from "xlsx";
import { describe, expect, it } from "vitest";
import {
  isMentorReportsSheet,
  mentorReportsLegacyAdapter,
} from "@/lib/data-import/adapters/legacy-mentor-reports";
import type { ParsedSheet } from "@/lib/data-import/parse";
import type { ValidationContext } from "@/lib/data-import/types";
import { validateBatch } from "@/lib/data-import/validate";

// Real header (row 10, 0-based) from MENTOR REPORTS.csv — flat, one row per session, no
// repeating month blocks. Column 14 and 19 are the literal same question text in the source
// sheet (paired with the academic vs. psychosocial context that precedes each).
const HEADER = [
  "FECHA DE REGISTRO",
  "MES",
  "País",
  "Soy: ",
  "Número de ID",
  "Cohorte del programa:",
  "Nombre del becario",
  "Universidad",
  "Sesión:",
  "Fecha",
  "Resumen de lo tratado en la sesión",
  "Modalidad del espacio",
  "¿Identifica señales que puedan poner en riesgo la permanencia del estudiante?",
  "ESTADO ACADÉMICO",
  "¿Qué situación específica está presentando el becario? (seleccione  máx 2 con más impacto en la permanencia)",
  "Número de asignaturas/cursos aprobados",
  "Número de asignaturas/cursos en riesgo de no aprobar (o no aprobados)",
  "Asignaturas con dificultades (separar con coma)",
  "ESTADO PSICOSOCIAL",
  "¿Qué situación específica está presentando el becario? (seleccione  máx 2 con más impacto en la permanencia)",
  "¿Cuál es el plan de acompañamiento?",
  "Tiempo estimado del acompañamiento",
  "Tutorías individuales",
  "Tutorías grupales",
  "Mentorías individuales",
  "Mentorías grupales",
  "Talleres grupales",
  "",
  "",
  "¿Qué mes reportas?",
  "Cuéntanos algo destacado sobre el/la becario(a) (ganó algún concurso, evento, intercambio, proyecto...)",
  "¿Cuál es el avance académico del becario(a)?",
  "Cuéntanos cuál es el plan y la fecha de inicio: ",
  "Escribe qué materias están rezagadas, semestre y número de veces cursadas, ejemplo para ponerlo: (Cálculo, primer semestre, segunda vez).",
  "Cuéntanos cuál es el plan y la fecha de inicio, ejemplo: (Cálculo, intersemestral en 2026-2; Física, créditos adicionales en 2026-2...)",
  "Submission ID",
];

const COL = {
  // NOTE: this column is actually the mentor's own ID ("Número de ID" follows "Soy: ", the
  // mentor's self-identification question) — MENTOR REPORTS has no real scholar-ID column at
  // all. validate.ts resolves the real scholarId by matching `scholarName` against
  // Scholar.fullName instead of trusting this field. Kept as a distinct field purely because the
  // adapter's canonical row shape still has a `scholarId` slot pending that resolution.
  scholarId: 4,
  cohort: 5,
  scholarName: 6,
  university: 7,
  sessionType: 8,
  permanenceRisk: 12,
  academicStatus: 13,
  academicAlertType: 14,
  approvedCourses: 15,
  atRiskCourses: 16,
  difficultSubjects: 17,
  psychosocialStatus: 18,
  psychosocialAlertType: 19,
  accompanimentPlan: 20,
  estimatedSupportTime: 21,
  individualTutoring: 22,
  groupTutoring: 23,
  individualMentoring: 24,
  groupMentoring: 25,
  workshops: 26,
  reportingMonth: 29,
  highlights: 30,
  academicProgressNotes: 31,
  nextSteps: 32,
  submissionId: 35,
} as const;

function buildSheet(aoa: unknown[][]): ParsedSheet {
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  const records = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, {
    defval: null,
    raw: true,
    blankrows: false,
  });
  return { sheetName: "MENTOR REPORTS", sheet: ws, records };
}

/** Mimics the real tab: a decorative mini pivot-table summary above the real header (row 10). */
function mentorReportsSheet(row: unknown[]): ParsedSheet {
  return buildSheet([
    [],
    ["SEGUIMIENTO REPORTE"],
    [],
    [null, "Mes 1", "Mes 2"],
    ["Cohorte 2025 COL", 0, 0],
    ["Cohorte 2026 COL", 0, 0],
    ["Cohorte 2025 PER", 0, 0],
    ["Cohorte 2026 PER", 0, 0],
    [],
    [],
    HEADER,
    row,
  ]);
}

function sampleRow(overrides: Partial<Record<keyof typeof COL, unknown>> = {}): unknown[] {
  const row = new Array(HEADER.length).fill(null);
  row[2] = "Colombia"; // País
  row[COL.scholarId] = "BT-CO-001";
  row[COL.cohort] = "2025";
  row[COL.scholarName] = "Ana Pérez Gómez";
  row[COL.university] = "Universidad Nacional de Colombia";
  row[COL.sessionType] = "Individual";
  row[COL.permanenceRisk] = "Bajo";
  row[COL.academicStatus] = "En riesgo";
  row[COL.academicAlertType] = "Bajo rendimiento";
  row[COL.approvedCourses] = 4;
  row[COL.atRiskCourses] = 1;
  row[COL.difficultSubjects] = "Cálculo";
  row[COL.psychosocialStatus] = "Estable";
  row[COL.psychosocialAlertType] = "Ninguna";
  row[COL.accompanimentPlan] = "Seguimiento quincenal";
  row[COL.estimatedSupportTime] = "1 mes";
  row[COL.individualTutoring] = 2;
  row[COL.groupTutoring] = 1;
  row[COL.individualMentoring] = 1;
  row[COL.groupMentoring] = 0;
  row[COL.workshops] = 1;
  row[COL.reportingMonth] = "2026-06";
  row[COL.highlights] = "Ganó un concurso";
  row[COL.academicProgressNotes] = "Va bien";
  row[COL.nextSteps] = "Nivelación en cálculo desde 2026-2";
  row[COL.submissionId] = "sub-001";
  for (const [key, value] of Object.entries(overrides)) {
    row[COL[key as keyof typeof COL]] = value;
  }
  return row;
}

describe("mentor-reports legacy adapter", () => {
  it("detects a mentor-reports sheet below the decorative summary rows", () => {
    expect(isMentorReportsSheet(mentorReportsSheet(sampleRow()))).toBe(true);
    expect(
      isMentorReportsSheet(buildSheet([["foo", "bar"], ["1", "2"]])),
    ).toBe(false);
  });

  it("maps identity, academic, and psychosocial fields — including the duplicate alert-type question", () => {
    const batch = mentorReportsLegacyAdapter(mentorReportsSheet(sampleRow()));
    expect(batch).toHaveLength(1);
    const r = batch[0].data;
    expect(r.scholarId).toBe("BT-CO-001");
    expect(r.scholarName).toBe("Ana Pérez Gómez");
    expect(r.country).toBe("COLOMBIA");
    expect(r.cohort).toBe("2025");
    expect(r.university).toBe("Universidad Nacional de Colombia");
    expect(r.reportingMonth).toBe("2026-06");
    expect(r.permanenceRisk).toBe("Bajo");
    expect(r.academicStatus).toBe("En riesgo");
    expect(r.academicAlertType).toBe("Bajo rendimiento");
    expect(r.psychosocialStatus).toBe("Estable");
    expect(r.psychosocialAlertType).toBe("Ninguna");
    expect(r.individualTutoring).toBe(2);
    expect(r.groupTutoring).toBe(1);
    expect(r.workshops).toBe(1);
    expect(r.submissionId).toBe("sub-001");
    expect(r.nextSteps).toBe("Nivelación en cálculo desde 2026-2");
  });

  it("skips blank rows and leaves submissionId unset when the sheet has none", () => {
    const blank = new Array(HEADER.length).fill(null);
    const noSubmission = sampleRow({ submissionId: null });
    const batch = mentorReportsLegacyAdapter(
      buildSheet([[], HEADER, blank, noSubmission]),
    );
    expect(batch).toHaveLength(1);
    expect(batch[0].data.submissionId).toBeNull();
  });

  it("produces rows that pass validation, synthesizing a submissionId when absent", () => {
    const ctx: ValidationContext = {
      existingScholarIds: new Set(["BT-CO-001"]),
      scholarIdsByNormalizedName: new Map([["ana perez gomez", ["BT-CO-001"]]]),
      countryByScholarId: new Map(),
      controls: new Map<string, Set<string>>([["country", new Set(["COLOMBIA", "PERU"])]]),
      universities: new Map(),
      operatorsByName: new Map(),
    };
    const batch = { MENTOR_REPORT: mentorReportsLegacyAdapter(mentorReportsSheet(sampleRow({ submissionId: null }))) };
    const res = validateBatch(batch, ctx);
    expect(res.errorRows).toBe(0);
    expect(res.validated.MENTOR_REPORT).toHaveLength(1);
    expect(res.validated.MENTOR_REPORT[0].submissionId).toMatch(/^import:mentor:BT-CO-001:/);
  });

  it("resolves scholarId by name even when the sheet's ID cell is the mentor's, not the scholar's", () => {
    const ctx: ValidationContext = {
      existingScholarIds: new Set(["BT-CO-001"]),
      scholarIdsByNormalizedName: new Map([["ana perez gomez", ["BT-CO-001"]]]),
      countryByScholarId: new Map(),
      controls: new Map<string, Set<string>>([["country", new Set(["COLOMBIA", "PERU"])]]),
      universities: new Map(),
      operatorsByName: new Map(),
    };
    // A mentor-shaped ID, not any real scholarId — this is the actual production bug shape.
    const row = sampleRow({ scholarId: "MENTOR-77" });
    const batch = { MENTOR_REPORT: mentorReportsLegacyAdapter(mentorReportsSheet(row)) };
    const res = validateBatch(batch, ctx);
    expect(res.errorRows).toBe(0);
    expect(res.validated.MENTOR_REPORT).toHaveLength(1);
    expect(res.validated.MENTOR_REPORT[0].scholarId).toBe("BT-CO-001");
  });

  it("rejects a mentor report whose scholar name matches no scholar", () => {
    const ctx: ValidationContext = {
      existingScholarIds: new Set(["BT-CO-001"]),
      scholarIdsByNormalizedName: new Map([["ana perez gomez", ["BT-CO-001"]]]),
      countryByScholarId: new Map(),
      controls: new Map<string, Set<string>>([["country", new Set(["COLOMBIA", "PERU"])]]),
      universities: new Map(),
      operatorsByName: new Map(),
    };
    // scholarId overridden to a non-existent value too — a valid direct ID would now (correctly)
    // rescue an unresolvable name, so this test's "no fallback available" case needs one.
    const row = sampleRow({ scholarName: "Nadie Existe", scholarId: "MENTOR-77" });
    const batch = { MENTOR_REPORT: mentorReportsLegacyAdapter(mentorReportsSheet(row)) };
    const res = validateBatch(batch, ctx);
    expect(res.errorRows).toBe(1);
    expect(res.errors[0].field).toBe("scholarName");
    expect(res.errors[0].message).toContain("Nadie Existe");
  });

  it("rejects a mentor report whose scholar name is ambiguous (shared by 2+ scholars)", () => {
    const ctx: ValidationContext = {
      existingScholarIds: new Set(["BT-CO-001", "BT-CO-002"]),
      scholarIdsByNormalizedName: new Map([["ana perez gomez", ["BT-CO-001", "BT-CO-002"]]]),
      countryByScholarId: new Map(),
      controls: new Map<string, Set<string>>([["country", new Set(["COLOMBIA", "PERU"])]]),
      universities: new Map(),
      operatorsByName: new Map(),
    };
    // scholarId overridden to a non-existent value too — a valid direct ID would now (correctly)
    // rescue an ambiguous name, so this test's "no fallback available" case needs one.
    const row = sampleRow({ scholarId: "MENTOR-77" });
    const batch = { MENTOR_REPORT: mentorReportsLegacyAdapter(mentorReportsSheet(row)) };
    const res = validateBatch(batch, ctx);
    expect(res.errorRows).toBe(1);
    expect(res.errors[0].field).toBe("scholarName");
    expect(res.errors[0].message).toContain("ambiguo");
    expect(res.errors[0].message).toContain("2");
  });

  it("does not drop a row with a blank mentor-ID cell as long as scholarName is present", () => {
    const row = sampleRow({ scholarId: null });
    const batch = mentorReportsLegacyAdapter(mentorReportsSheet(row));
    expect(batch).toHaveLength(1);
    expect(batch[0].data.scholarName).toBe("Ana Pérez Gómez");
  });

  it("detects and maps the new sheet's English header shape, including a genuine direct scholar ID", () => {
    const newHeader = [
      "DATE", "SEMESTER", "MONTH", "COUNTRY", "MENTOR'S NAME", "MENTOR ID", "COHORT",
      "ID OF THE SCHOLAR", "SCHOLAR'S NAME", "UNIVERSITY", "SESSION", "DATE OF THE SESSION",
      "RESUME", "Modalidad del espacio", "¿Tiene riesgo de permanencia?", "ACADEMIC STATUS",
      "GLOBAL STATUS", "Tutorías individuales", "Talleres grupales", "Submission ID",
    ];
    const newRow = [
      "2026-06-01", "5", "Junio", "Colombia", "Mentor English Header", "MTR-99", "2025",
      "BT-CO-090", "English Header Scholar", "Universidad Nacional de Colombia", "Individual",
      "2026-06-02", "Fue una buena sesión", "Virtual", "Bajo", "En riesgo", "Estable", 2, 1,
      "sub-en-001",
    ];
    const sheet: ParsedSheet = {
      sheetName: "MENTOR REPORTS",
      sheet: XLSX.utils.aoa_to_sheet([newHeader, newRow]),
      records: [],
    };

    expect(isMentorReportsSheet(sheet)).toBe(true);
    const batch = mentorReportsLegacyAdapter(sheet);
    expect(batch).toHaveLength(1);
    expect(batch[0].data.scholarId).toBe("BT-CO-090"); // the genuine direct ID, not "MTR-99"
    expect(batch[0].data.scholarName).toBe("English Header Scholar");
    expect(batch[0].data.mentorName).toBe("Mentor English Header");
    expect(batch[0].data.semester).toBe("5");
    expect(batch[0].data.mentorReportedGlobalStatus).toBe("Estable");
    expect(batch[0].data.sessionDate).toBeInstanceOf(Date);
    expect(batch[0].data.submissionId).toBe("sub-en-001");
  });
});
