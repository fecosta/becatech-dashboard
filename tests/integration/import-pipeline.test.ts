import { afterAll, beforeEach, describe, expect, it } from "vitest";
import {
  commitImportBatch,
  createImportBatch,
  rollbackImportBatch,
} from "@/lib/data-import/service";
import { prisma } from "@/lib/db";
import { csvBuffer, resetDb, seedFixture, seedOperatorFixture, xlsxBuffer } from "./helpers";

let uploaderId: string;

beforeEach(async () => {
  await resetDb();
  ({ uploaderId } = await seedFixture());
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("import pipeline (integration)", () => {
  it("template happy path: commits academic terms", async () => {
    const data = csvBuffer("scholarId,term,gpa,failedSubjectsCount\nBT-CO-001,2025-1,2.0,2\n");
    const { batchId, result } = await createImportBatch({
      data,
      filename: "terms.csv",
      sourceType: "TEMPLATE",
      entity: "ACADEMIC_TERM",
      uploadedById: uploaderId,
    });
    expect(result.successRows).toBe(1);

    const { commit } = await commitImportBatch(batchId);
    expect(commit.successRows).toBe(1);
    expect(commit.touchedRiskEntities).toBe(true); // academic term is a risk-input entity

    expect(await prisma.academicTerm.count({ where: { scholarId: "BT-CO-001", term: "2025-1" } })).toBe(1);
    const batch = await prisma.dataImportBatch.findUnique({ where: { id: batchId } });
    expect(batch?.status).toBe("COMMITTED");
  });

  it("ingests the stored monthly risk classification into RiskAssessment (MONTHLY_STATUS)", async () => {
    // Global risk is now INGESTED from the SUPPORT ACTIVITY LOG (its sheet-computed classification),
    // not derived. A MONTHLY_STATUS row maps the Spanish levels straight onto RiskAssessment.
    const data = csvBuffer(
      "scholarId,period,globalRisk,academicAxis,psychosocialAxis\n" +
        "BT-CO-001,MES 1,RIESGO ALTO,ALTO,SIN ALERTAS\n",
    );
    const { batchId, result } = await createImportBatch({
      data,
      filename: "monthly-status.csv",
      sourceType: "TEMPLATE",
      entity: "MONTHLY_STATUS",
      uploadedById: uploaderId,
    });
    expect(result.errorRows).toBe(0);
    const { recomputed } = await commitImportBatch(batchId);
    expect(recomputed).toBe(0); // ingested, never recomputed

    const risk = await prisma.riskAssessment.findUnique({
      where: { scholarId_period: { scholarId: "BT-CO-001", period: "MES 1" } },
    });
    expect(risk?.source).toBe("sheet");
    expect(risk?.globalRiskLevel).toBe("RIESGO_ALTO");
    expect(risk?.globalRiskValue).toBe(3);
    expect(risk?.academicRiskLevel).toBe("RIESGO_ALTO"); // "ALTO" axis → RIESGO_ALTO
    expect(risk?.psychosocialRiskLevel).toBe("SIN_RIESGO"); // "SIN ALERTAS" → SIN_RIESGO
    expect(risk?.assessmentComplete).toBe(true); // the sheet classified it → complete
    expect(risk?.alertType).toBe("ACADEMIC"); // academic axis is the sole driver of the max
  });

  it("rejects a monthly-status row with an unrecognized risk classification", async () => {
    const data = csvBuffer("scholarId,period,globalRisk\nBT-CO-001,MES 1,TOTALMENTE PERDIDO\n");
    const { result } = await createImportBatch({
      data,
      filename: "monthly-status.csv",
      sourceType: "TEMPLATE",
      entity: "MONTHLY_STATUS",
      uploadedById: uploaderId,
    });
    expect(result.successRows).toBe(0);
    expect(result.errors.find((e) => e.field === "globalRisk")?.message).toContain("TOTALMENTE PERDIDO");
  });

  it("no import recomputes risk anymore (derived global risk retired)", async () => {
    // A check-in used to trigger a recompute; now nothing does — risk is ingested from mentor
    // reports' GLOBAL STATUS (and the manual MONTHLY_STATUS path), never derived.
    const data = csvBuffer("scholarId,reportingMonth,finalStatus\nBT-CO-001,2026-06,En riesgo\n");
    const { batchId } = await createImportBatch({
      data,
      filename: "checkin.csv",
      sourceType: "TEMPLATE",
      entity: "MONTHLY_CHECKIN",
      uploadedById: uploaderId,
    });
    const { recomputed } = await commitImportBatch(batchId);
    expect(recomputed).toBe(0);
    expect(await prisma.riskAssessment.count()).toBe(0);
  });

  it("a mentor report's GLOBAL STATUS becomes the scholar's risk for that MES (ingested)", async () => {
    const data = csvBuffer(
      "scholarId,reportingMonth,submissionId,mentorReportedGlobalStatus,academicStatus,psychosocialStatus\n" +
        "BT-CO-001,MES 1,sub-risk-1,RIESGO ALTO,ALTO,SIN ALERTAS\n",
    );
    const { batchId } = await createImportBatch({
      data,
      filename: "mentor.csv",
      sourceType: "TEMPLATE",
      entity: "MENTOR_REPORT",
      uploadedById: uploaderId,
    });
    const { recomputed } = await commitImportBatch(batchId);
    expect(recomputed).toBe(0); // ingested from GLOBAL STATUS, never recomputed

    const risk = await prisma.riskAssessment.findUnique({
      where: { scholarId_period: { scholarId: "BT-CO-001", period: "MES 1" } },
    });
    expect(risk?.source).toBe("mentor-report");
    expect(risk?.globalRiskLevel).toBe("RIESGO_ALTO");
    expect(risk?.academicRiskLevel).toBe("RIESGO_ALTO");
    expect(risk?.psychosocialRiskLevel).toBe("SIN_RIESGO");
  });

  it("a mentor report with a blank GLOBAL STATUS writes no risk row (unclassified scholar-month)", async () => {
    const data = csvBuffer(
      "scholarId,reportingMonth,submissionId,mentorReportedGlobalStatus\nBT-CO-001,MES 1,sub-norisk-1,\n",
    );
    const { batchId } = await createImportBatch({
      data,
      filename: "mentor.csv",
      sourceType: "TEMPLATE",
      entity: "MENTOR_REPORT",
      uploadedById: uploaderId,
    });
    await commitImportBatch(batchId);
    expect(await prisma.mentorReport.count({ where: { scholarId: "BT-CO-001" } })).toBe(1); // report kept
    expect(await prisma.riskAssessment.count()).toBe(0); // but no risk classification
  });

  it("keys risk by the session-date month when the reporting-month label is blank", async () => {
    // The live sheet leaves "¿Qué mes reportas?" blank but always has a session date → the reporting
    // month must fall back to the session date, else the report keys no risk (the production bug).
    const data = csvBuffer(
      "scholarId,submissionId,sessionDate,mentorReportedGlobalStatus\nBT-CO-001,sub-sd-1,2026-03-15,RIESGO ALTO\n",
    );
    const { batchId } = await createImportBatch({
      data,
      filename: "mentor.csv",
      sourceType: "TEMPLATE",
      entity: "MENTOR_REPORT",
      uploadedById: uploaderId,
    });
    await commitImportBatch(batchId);
    const risk = await prisma.riskAssessment.findUnique({
      where: { scholarId_period: { scholarId: "BT-CO-001", period: "2026-03" } },
    });
    expect(risk?.source).toBe("mentor-report");
    expect(risk?.globalRiskLevel).toBe("RIESGO_ALTO");
  });

  it("legacy wide .xlsx: normalizes into scholar + academic terms", async () => {
    const data = xlsxBuffer([
      ["ID", "PAÍS", "COHORTE", "UNIVERSIDAD", "PROGRAMA ACADÉMICO", "NOMBRE COMPLETO", "GÉNERO", "ESTADO ACTUAL", "GPA 2024-1", "GPA 2024-2"],
      ["BT-CO-050", "Colombia", "2024", "UNAL", "CS", "Legacy One", "Female", "Activo", "4.0", "3.5"],
    ]);
    const { batchId, result } = await createImportBatch({
      data,
      filename: "legacy.xlsx",
      sourceType: "LEGACY_WIDE_EXCEL",
      uploadedById: uploaderId,
    });
    expect(result.errorRows).toBe(0);

    await commitImportBatch(batchId);
    expect(await prisma.scholar.count({ where: { scholarId: "BT-CO-050" } })).toBe(1);
    expect(await prisma.academicTerm.count({ where: { scholarId: "BT-CO-050" } })).toBe(2);
  });

  it("partial failure: commits valid rows, reports invalid", async () => {
    const data = csvBuffer("scholarId,term,gpa\nBT-CO-001,2025-1,4.0\nBT-XX-999,2025-1,4.0\n");
    const { batchId, result } = await createImportBatch({
      data,
      filename: "partial.csv",
      sourceType: "TEMPLATE",
      entity: "ACADEMIC_TERM",
      uploadedById: uploaderId,
    });
    expect(result.successRows).toBe(1);
    expect(result.errorRows).toBe(1);

    await commitImportBatch(batchId);
    expect(await prisma.academicTerm.count()).toBe(1);
  });

  it("idempotent re-upload: same file twice does not duplicate", async () => {
    const csv = "scholarId,term,gpa\nBT-CO-001,2025-1,4.0\n";
    for (let i = 0; i < 2; i += 1) {
      const { batchId } = await createImportBatch({
        data: csvBuffer(csv),
        filename: "idem.csv",
        sourceType: "TEMPLATE",
        entity: "ACADEMIC_TERM",
        uploadedById: uploaderId,
      });
      await commitImportBatch(batchId);
    }
    expect(await prisma.academicTerm.count({ where: { scholarId: "BT-CO-001", term: "2025-1" } })).toBe(1);
  });

  it("does not recompute risk when importing the deprecated support-activity log", async () => {
    // The SUPPORT ACTIVITY LOG is still accepted for backward compatibility but no longer feeds
    // risk — importing it must neither flag a risk touch nor create a risk row (its `MES`-shaped
    // periods previously corrupted the risk period space).
    const data = csvBuffer(
      "scholarId,period,activityType,activityCount\nBT-CO-001,MES 7,INDIVIDUAL_TUTORING,3\n",
    );
    const { batchId } = await createImportBatch({
      data,
      filename: "support.csv",
      sourceType: "TEMPLATE",
      entity: "SUPPORT_ACTIVITY",
      uploadedById: uploaderId,
    });
    const { commit, recomputed } = await commitImportBatch(batchId);
    expect(commit.touchedRiskEntities).toBe(false);
    expect(recomputed).toBe(0);
    expect(await prisma.supportActivity.count({ where: { scholarId: "BT-CO-001" } })).toBe(1); // still upserted
    expect(await prisma.riskAssessment.count()).toBe(0); // but risk untouched
  });

  it("does not recompute risk for financial-only batches", async () => {
    const data = csvBuffer("scholarId,period,costCategory,costAmount,currency\nBT-CO-001,2026,Tuition,5000000,COP\n");
    const { batchId } = await createImportBatch({
      data,
      filename: "fin.csv",
      sourceType: "TEMPLATE",
      entity: "FINANCIAL_INPUT",
      uploadedById: uploaderId,
    });
    const { commit, recomputed } = await commitImportBatch(batchId);
    expect(commit.touchedRiskEntities).toBe(false);
    expect(recomputed).toBe(0);
    expect(await prisma.riskAssessment.count()).toBe(0);
  });

  it("resolves a university naming variant via the alias map (Universidad Nacional → UNAL)", async () => {
    // seedFixture() seeds a "UNAL" university; the sheet spells it "Universidad Nacional".
    const data = csvBuffer(
      "scholarId,fullName,country,cohort,university,academicProgram,gender\n" +
        "BT-CO-064,Alias Uni Scholar,COLOMBIA,2026,Universidad Nacional,CS,Female\n",
    );
    const { batchId, result } = await createImportBatch({
      data,
      filename: "scholars.csv",
      sourceType: "TEMPLATE",
      entity: "SCHOLAR",
      uploadedById: uploaderId,
    });
    expect(result.errors.some((e) => e.field === "university")).toBe(false);
    expect(result.successRows).toBe(1);
    await commitImportBatch(batchId);
    const scholar = await prisma.scholar.findUnique({
      where: { scholarId: "BT-CO-064" },
      include: { university: true },
    });
    expect(scholar?.university.name).toBe("UNAL");
  });

  it("captures academic progress (col AR) and current English level (col AY) on scholar import", async () => {
    const data = csvBuffer(
      "scholarId,fullName,country,cohort,university,academicProgram,gender,academicProgress,currentEnglishLevel\n" +
        "BT-CO-070,Prog Scholar,COLOMBIA,2025,UNAL,CS,Female,On track,B1\n",
    );
    const { batchId, result } = await createImportBatch({
      data,
      filename: "scholars.csv",
      sourceType: "TEMPLATE",
      entity: "SCHOLAR",
      uploadedById: uploaderId,
    });
    expect(result.errorRows).toBe(0);
    await commitImportBatch(batchId);
    const s = await prisma.scholar.findUnique({ where: { scholarId: "BT-CO-070" } });
    expect(s?.academicProgress).toBe("On track");
    expect(s?.currentEnglishLevel).toBe("B1");
  });

  it("rejects a new scholar row with an unrecognized university", async () => {
    const data = csvBuffer(
      "scholarId,fullName,country,cohort,university,academicProgram,gender\n" +
        "BT-CO-060,New Scholar,COLOMBIA,2026,Universidad Inexistente,CS,Female\n",
    );
    const { result } = await createImportBatch({
      data,
      filename: "scholars.csv",
      sourceType: "TEMPLATE",
      entity: "SCHOLAR",
      uploadedById: uploaderId,
    });
    expect(result.successRows).toBe(0);
    expect(result.errorRows).toBe(1);
    const error = result.errors.find((e) => e.field === "university");
    expect(error?.message).toContain("Universidad Inexistente");
    expect(await prisma.scholar.count({ where: { scholarId: "BT-CO-060" } })).toBe(0);
  });

  it("resolves a new scholar row's operator by name, end to end", async () => {
    const { name } = await seedOperatorFixture();
    const data = csvBuffer(
      "scholarId,fullName,country,cohort,university,academicProgram,gender,operator\n" +
        `BT-CO-061,Operator Scholar,COLOMBIA,2026,UNAL,CS,Female,${name}\n`,
    );
    const { batchId, result } = await createImportBatch({
      data,
      filename: "scholars.csv",
      sourceType: "TEMPLATE",
      entity: "SCHOLAR",
      uploadedById: uploaderId,
    });
    expect(result.successRows).toBe(1);
    await commitImportBatch(batchId);
    const scholar = await prisma.scholar.findUnique({ where: { scholarId: "BT-CO-061" } });
    expect(scholar?.operatorId).not.toBeNull();
  });

  it("resolves an approved operator alias (FATV → Fundación Antivirus para la Deserción)", async () => {
    const { operatorId } = await seedOperatorFixture(); // seeds "Fundación Antivirus para la Deserción"
    const data = csvBuffer(
      "scholarId,fullName,country,cohort,university,academicProgram,gender,operator\n" +
        "BT-CO-063,Alias Scholar,COLOMBIA,2026,UNAL,CS,Female,FATV\n",
    );
    const { batchId, result } = await createImportBatch({
      data,
      filename: "scholars.csv",
      sourceType: "TEMPLATE",
      entity: "SCHOLAR",
      uploadedById: uploaderId,
    });
    expect(result.successRows).toBe(1);
    await commitImportBatch(batchId);
    const scholar = await prisma.scholar.findUnique({ where: { scholarId: "BT-CO-063" } });
    expect(scholar?.operatorId).toBe(operatorId);
  });

  it("keeps a scholar whose operator is unrecognized (operatorId null, never auto-created)", async () => {
    const data = csvBuffer(
      "scholarId,fullName,country,cohort,university,academicProgram,gender,operator\n" +
        "BT-CO-062,New Scholar,COLOMBIA,2026,UNAL,CS,Female,Some Unknown Operator\n",
    );
    const { batchId, result } = await createImportBatch({
      data,
      filename: "scholars.csv",
      sourceType: "TEMPLATE",
      entity: "SCHOLAR",
      uploadedById: uploaderId,
    });
    expect(result.successRows).toBe(1);
    expect(result.errors.some((e) => e.field === "operator")).toBe(false);
    await commitImportBatch(batchId);
    const scholar = await prisma.scholar.findUnique({ where: { scholarId: "BT-CO-062" } });
    expect(scholar).not.toBeNull();
    expect(scholar?.operatorId).toBeNull();
    // Still never auto-creates an operator from the unknown label.
    expect(await prisma.operator.count({ where: { name: "Some Unknown Operator" } })).toBe(0);
  });

  it("rollback deletes the rows the batch created", async () => {
    const data = csvBuffer("scholarId,term,gpa\nBT-CO-001,2025-2,3.0\n");
    const { batchId } = await createImportBatch({
      data,
      filename: "rb.csv",
      sourceType: "TEMPLATE",
      entity: "ACADEMIC_TERM",
      uploadedById: uploaderId,
    });
    await commitImportBatch(batchId);
    expect(await prisma.academicTerm.count({ where: { term: "2025-2" } })).toBe(1);

    const { deleted } = await rollbackImportBatch(batchId);
    expect(deleted).toBeGreaterThanOrEqual(1);
    expect(await prisma.academicTerm.count({ where: { term: "2025-2" } })).toBe(0);
    const batch = await prisma.dataImportBatch.findUnique({ where: { id: batchId } });
    expect(batch?.rolledBackAt).not.toBeNull();
  });
});
