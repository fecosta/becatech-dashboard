import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { POST } from "@/app/api/sync/import/route";
import { prisma } from "@/lib/db";
import { resetDb, seedFixture } from "./helpers";

const API_KEY = "test-sync-key";
process.env.SHEETS_SYNC_API_KEY = API_KEY;
const SYNC_ENDPOINT = "http://localhost/api/sync/import";

function syncRequest(body: string, headers: Record<string, string> = {}): Request {
  return new Request(SYNC_ENDPOINT, { method: "POST", headers, body });
}

// Same real MENTOR REPORTS header used by the adapter unit tests.
const MENTOR_HEADER = [
  "FECHA DE REGISTRO", "MES", "País", "Soy: ", "Número de ID", "Cohorte del programa:",
  "Nombre del becario", "Universidad", "Sesión:", "Fecha", "Resumen de lo tratado en la sesión",
  "Modalidad del espacio", "¿Identifica señales que puedan poner en riesgo la permanencia del estudiante?",
  "ESTADO ACADÉMICO", "¿Qué situación específica está presentando el becario? (seleccione  máx 2 con más impacto en la permanencia)",
  "Número de asignaturas/cursos aprobados", "Número de asignaturas/cursos en riesgo de no aprobar (o no aprobados)",
  "Asignaturas con dificultades (separar con coma)", "ESTADO PSICOSOCIAL",
  "¿Qué situación específica está presentando el becario? (seleccione  máx 2 con más impacto en la permanencia)",
  "¿Cuál es el plan de acompañamiento?", "Tiempo estimado del acompañamiento",
  "Tutorías individuales", "Tutorías grupales", "Mentorías individuales", "Mentorías grupales",
  "Talleres grupales", "", "", "¿Qué mes reportas?", "Destacado", "Avance", "Plan", "Rezagadas", "PlanEjemplo",
  "Submission ID",
];

function mentorReportsCsv(rows: Record<string, unknown>[]): string {
  const idx = new Map(MENTOR_HEADER.map((h, i) => [h, i]));
  const lines = [MENTOR_HEADER.join(",")];
  for (const fields of rows) {
    const row = new Array(MENTOR_HEADER.length).fill("");
    for (const [key, value] of Object.entries(fields)) {
      const i = idx.get(key);
      if (i !== undefined) row[i] = String(value ?? "");
    }
    lines.push(row.join(","));
  }
  return lines.join("\n");
}

// Same real SUPPORT ACTIVITY LOG identity + one month block used by the adapter unit tests.
const SUPPORT_SUB_HEADER = [
  "ID", "PAÍS", "NOMBRE BECARIO(A)", "MENTOR(A)", "ID", "COHORTE", "UNIVERSIDAD", "CARRERA", "SEMESTRE", "ESTADO EN EL PROGRAMA",
  "MES", "Tutorías IND", "Tutorías GRUP", "Mentorías IND", "Mentorías GRUP", "Talleres", "Participación en estrategias",
];

function supportActivityLogCsv(row: unknown[]): string {
  const blockLabels = new Array(SUPPORT_SUB_HEADER.length).fill("");
  return [blockLabels.join(","), SUPPORT_SUB_HEADER.join(","), row.join(",")].join("\n");
}

beforeEach(async () => {
  await resetDb();
  await seedFixture();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("sync endpoint (integration)", () => {
  it("rejects requests with no api key", async () => {
    const res = await POST(syncRequest("scholarId,term,gpa\nBT-CO-001,2025-1,4.0\n"));
    expect(res.status).toBe(401);
  });

  it("rejects requests with a wrong api key", async () => {
    const res = await POST(syncRequest("x", { "x-api-key": "wrong-key" }));
    expect(res.status).toBe(401);
  });

  it("mentor reports happy path: commits and attributes the batch to the sync system user", async () => {
    // "Número de ID" is deliberately the mentor's (wrong) ID, not the scholar's — proves scholarId
    // resolution goes by "Nombre del becario" and ignores this field, matching real sheet shape.
    const csv = mentorReportsCsv([
      {
        "Número de ID": "MENTOR-77",
        "Nombre del becario": "Fixture Scholar",
        "¿Qué mes reportas?": "2026-06",
        "Submission ID": "sub-e2e-001",
      },
    ]);
    const res = await POST(syncRequest(csv, { "x-api-key": API_KEY, "x-sheet-name": "MENTOR REPORTS" }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.committed).toBe(true);
    expect(json.entities).toEqual(["MENTOR_REPORT"]);
    expect(json.successRows).toBe(1);
    expect(json.errorRows).toBe(0);

    const report = await prisma.mentorReport.findUnique({ where: { submissionId: "sub-e2e-001" } });
    expect(report?.scholarId).toBe("BT-CO-001");
    expect(report?.reportingMonth).toBe("2026-06");

    const batch = await prisma.dataImportBatch.findUnique({
      where: { id: json.batchId },
      include: { uploadedBy: true },
    });
    expect(batch?.status).toBe("COMMITTED");
    expect(batch?.uploadedBy.email).toBe("sheets-sync@becatech.internal");
  });

  it("support activity log happy path: pivots the month block into SupportActivity rows", async () => {
    const row = ["BT-CO-001", "Colombia", "Fixture Scholar", "Mentor X", "MENTOR-1", "2025", "UNAL", "CS", "3", "Activo", "2026-06", "2", "1", "0", "0", "1", "bien"];
    const res = await POST(
      syncRequest(supportActivityLogCsv(row), { "x-api-key": API_KEY, "x-sheet-name": "SUPPORT ACTIVITY LOG" }),
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.committed).toBe(true);
    expect(json.entities).toEqual(["SUPPORT_ACTIVITY"]);
    expect(json.successRows).toBe(5);

    const rows = await prisma.supportActivity.findMany({ where: { scholarId: "BT-CO-001", period: "2026-06" } });
    expect(rows).toHaveLength(5);
    expect(rows.every((r) => r.source === "google-sheets-sync")).toBe(true);
    const tutoring = rows.find((r) => r.activityType === "INDIVIDUAL_TUTORING");
    expect(tutoring?.activityCount).toBe(2);
  });

  it("partial failure: commits the valid row, logs the invalid one, still returns 200", async () => {
    const csv = mentorReportsCsv([
      {
        "Número de ID": "MENTOR-77",
        "Nombre del becario": "Fixture Scholar",
        "¿Qué mes reportas?": "2026-06",
        "Submission ID": "sub-ok",
      },
      {
        "Número de ID": "MENTOR-77",
        "Nombre del becario": "Nadie Existe",
        "¿Qué mes reportas?": "2026-06",
        "Submission ID": "sub-bad",
      },
    ]);
    const res = await POST(syncRequest(csv, { "x-api-key": API_KEY }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.committed).toBe(true);
    expect(json.successRows).toBe(1);
    expect(json.errorRows).toBe(1);
    expect(json.errors[0].message).toContain("Nadie Existe");

    expect(await prisma.mentorReport.count()).toBe(1);
    expect(await prisma.mentorReport.findUnique({ where: { submissionId: "sub-ok" } })).not.toBeNull();
  });

  it("does not collide two scholars' reports into one when they share a mentor and month", async () => {
    // Both rows use the SAME mentor-shaped "Número de ID" and the same reporting month, with no
    // sheet-provided Submission ID — if scholarId resolution ran after the synthetic-submissionId
    // computation (instead of before), both rows would derive the identical synthetic key and the
    // second would silently overwrite the first via the upsert's ON CONFLICT.
    const university = await prisma.university.findFirstOrThrow();
    await prisma.scholar.create({
      data: {
        scholarId: "BT-CO-002",
        fullName: "Other Scholar",
        country: "COLOMBIA",
        cohort: "2025",
        universityId: university.id,
        academicProgram: "CS",
        gender: "Male",
        programStatus: "ACTIVE",
      },
    });
    const csv = mentorReportsCsv([
      { "Número de ID": "MENTOR-77", "Nombre del becario": "Fixture Scholar", "¿Qué mes reportas?": "2026-06" },
      { "Número de ID": "MENTOR-77", "Nombre del becario": "Other Scholar", "¿Qué mes reportas?": "2026-06" },
    ]);
    const res = await POST(syncRequest(csv, { "x-api-key": API_KEY }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.committed).toBe(true);
    expect(json.successRows).toBe(2);
    expect(json.errorRows).toBe(0);

    const reports = await prisma.mentorReport.findMany({ where: { reportingMonth: "2026-06" } });
    expect(reports).toHaveLength(2);
    expect(reports.map((r) => r.scholarId).sort()).toEqual(["BT-CO-001", "BT-CO-002"]);
  });

  it("idempotent re-sync: posting the same CSV twice does not duplicate rows", async () => {
    const csv = mentorReportsCsv([
      { "Número de ID": "BT-CO-001", "¿Qué mes reportas?": "2026-06", "Submission ID": "sub-idem" },
    ]);
    for (let i = 0; i < 2; i += 1) {
      const res = await POST(syncRequest(csv, { "x-api-key": API_KEY }));
      expect(res.status).toBe(200);
    }
    expect(await prisma.mentorReport.count({ where: { submissionId: "sub-idem" } })).toBe(1);
  });

  it("rejects an unrecognized x-entity value", async () => {
    const res = await POST(syncRequest("a,b\n1,2", { "x-api-key": API_KEY, "x-entity": "NOT_A_REAL_ENTITY" }));
    expect(res.status).toBe(400);
  });

  it("x-entity: SCHOLAR uses the TEMPLATE adapter on a clean, canonical-header CSV", async () => {
    const csv = "scholarId,fullName,country,cohort,university,academicProgram,gender\nBT-CO-050,New Scholar,COLOMBIA,2025,UNAL,CS,Female\n";
    const res = await POST(syncRequest(csv, { "x-api-key": API_KEY, "x-entity": "SCHOLAR", "x-sheet-name": "NORMALIZED_SCHOLAR" }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.committed).toBe(true);
    expect(json.entities).toEqual(["SCHOLAR"]);
    expect(json.successRows).toBe(1);

    const scholar = await prisma.scholar.findUnique({ where: { scholarId: "BT-CO-050" } });
    expect(scholar?.fullName).toBe("New Scholar");
    expect(scholar?.gender).toBe("Female");
  });

  it("x-entity: ACADEMIC_TERM uses the TEMPLATE adapter and attaches to an existing scholar", async () => {
    const csv = "scholarId,term,gpa\nBT-CO-001,2025-2,4.2\n";
    const res = await POST(syncRequest(csv, { "x-api-key": API_KEY, "x-entity": "ACADEMIC_TERM" }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.committed).toBe(true);
    expect(json.successRows).toBe(1);

    const term = await prisma.academicTerm.findUnique({
      where: { scholarId_term: { scholarId: "BT-CO-001", term: "2025-2" } },
    });
    expect(term?.gpa).toBe(4.2);
  });

  it("rollback still works for a sync-created batch", async () => {
    const csv = mentorReportsCsv([
      { "Número de ID": "BT-CO-001", "¿Qué mes reportas?": "2026-06", "Submission ID": "sub-rollback" },
    ]);
    const res = await POST(syncRequest(csv, { "x-api-key": API_KEY }));
    const { batchId } = await res.json();
    expect(await prisma.mentorReport.count({ where: { submissionId: "sub-rollback" } })).toBe(1);

    const { rollbackImportBatch } = await import("@/lib/data-import/service");
    const { deleted } = await rollbackImportBatch(batchId);
    expect(deleted).toBeGreaterThanOrEqual(1);
    expect(await prisma.mentorReport.count({ where: { submissionId: "sub-rollback" } })).toBe(0);
  });
});
