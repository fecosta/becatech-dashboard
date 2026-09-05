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
    // `semester` is an optional column on this entity (see docs/adr/008-risk-period-identity.md) —
    // when present it passes straight through onto the RiskAssessment row.
    const data = csvBuffer(
      "scholarId,period,semester,globalRisk,academicAxis,psychosocialAxis\n" +
        "BT-CO-001,MES 1,2026-1,RIESGO ALTO,ALTO,SIN ALERTAS\n",
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
      where: { scholarId_semester_period: { scholarId: "BT-CO-001", semester: "2026-1", period: "MES 1" } },
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

    // No `semester` column and no `country` (so the calendar-derived fallback can't resolve one
    // either) — the risk row is still created (graceful degradation, see
    // docs/adr/008-risk-period-identity.md), just with a null semester.
    const risk = await prisma.riskAssessment.findFirst({
      where: { scholarId: "BT-CO-001", semester: null, period: "MES 1" },
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
    // No country/semester column → graceful degradation, semester stays null.
    const risk = await prisma.riskAssessment.findFirst({
      where: { scholarId: "BT-CO-001", semester: null, period: "2026-03" },
    });
    expect(risk?.source).toBe("mentor-report");
    expect(risk?.globalRiskLevel).toBe("RIESGO_ALTO");
  });

  it("derives programMonth (MES n) + semester from country + session date", async () => {
    // Colombia 2026-05-01 falls in MES 3 (Apr 15 – May 11) of semester 2026-1.
    const data = csvBuffer(
      "scholarId,submissionId,country,sessionDate,mentorReportedGlobalStatus\n" +
        "BT-CO-001,sub-pm-1,COLOMBIA,2026-05-01,RIESGO ALTO\n",
    );
    const { batchId } = await createImportBatch({
      data,
      filename: "mentor.csv",
      sourceType: "TEMPLATE",
      entity: "MENTOR_REPORT",
      uploadedById: uploaderId,
    });
    await commitImportBatch(batchId);
    const report = await prisma.mentorReport.findUnique({ where: { submissionId: "sub-pm-1" } });
    expect(report?.programMonth).toBe("MES 3");
    expect(report?.semester).toBe("2026-1"); // sheet semester blank → derived
    // Additive: reportingMonth (calendar) still drives the risk period, untouched by programMonth.
    expect(report?.reportingMonth).toBe("2026-05");
    const risk = await prisma.riskAssessment.findUnique({
      where: { scholarId_semester_period: { scholarId: "BT-CO-001", semester: "2026-1", period: "2026-05" } },
    });
    expect(risk?.globalRiskLevel).toBe("RIESGO_ALTO");
  });

  it("leaves programMonth null for an out-of-window session date (report + risk still commit)", async () => {
    // Colombia opens Feb 17; a Jan session is outside every configured window → programMonth null,
    // never guessed. The report still upserts and risk is still keyed by the reporting month.
    const data = csvBuffer(
      "scholarId,submissionId,country,sessionDate,mentorReportedGlobalStatus\n" +
        "BT-CO-001,sub-pm-2,COLOMBIA,2026-01-05,RIESGO ALTO\n",
    );
    const { batchId } = await createImportBatch({
      data,
      filename: "mentor.csv",
      sourceType: "TEMPLATE",
      entity: "MENTOR_REPORT",
      uploadedById: uploaderId,
    });
    await commitImportBatch(batchId);
    const report = await prisma.mentorReport.findUnique({ where: { submissionId: "sub-pm-2" } });
    expect(report).not.toBeNull(); // report still committed
    expect(report?.programMonth).toBeNull(); // out of window → null
    expect(report?.semester).toBeNull(); // same out-of-window gap: no calendar fallback either
    // Risk still commits (graceful degradation) with a null semester, not a fabricated one.
    const risk = await prisma.riskAssessment.findFirst({
      where: { scholarId: "BT-CO-001", semester: null, period: "2026-01" },
    });
    expect(risk?.globalRiskLevel).toBe("RIESGO_ALTO");
  });

  it("two semesters' reports at the same MES n coexist as separate RiskAssessment rows (collision fix)", async () => {
    const data = csvBuffer(
      "scholarId,reportingMonth,submissionId,mentorReportedGlobalStatus,semester\n" +
        "BT-CO-001,MES 3,sub-collision-1,RIESGO ALTO,2026-1\n" +
        "BT-CO-001,MES 3,sub-collision-2,RIESGO BAJO,2026-2\n",
    );
    const { batchId } = await createImportBatch({
      data,
      filename: "mentor.csv",
      sourceType: "TEMPLATE",
      entity: "MENTOR_REPORT",
      uploadedById: uploaderId,
    });
    await commitImportBatch(batchId);

    expect(await prisma.riskAssessment.count({ where: { scholarId: "BT-CO-001", period: "MES 3" } })).toBe(2);

    const first = await prisma.riskAssessment.findUnique({
      where: { scholarId_semester_period: { scholarId: "BT-CO-001", semester: "2026-1", period: "MES 3" } },
    });
    const second = await prisma.riskAssessment.findUnique({
      where: { scholarId_semester_period: { scholarId: "BT-CO-001", semester: "2026-2", period: "MES 3" } },
    });
    expect(first?.globalRiskLevel).toBe("RIESGO_ALTO");
    expect(second?.globalRiskLevel).toBe("RIESGO_BAJO");
  });

  it("isolation: querying one semester's MES n never returns another semester's same-numbered month", async () => {
    const data = csvBuffer(
      "scholarId,reportingMonth,submissionId,mentorReportedGlobalStatus,semester\n" +
        "BT-CO-001,MES 3,sub-iso-1,RIESGO ALTO,2026-1\n" +
        "BT-CO-001,MES 3,sub-iso-2,RIESGO BAJO,2026-2\n",
    );
    const { batchId } = await createImportBatch({
      data,
      filename: "mentor.csv",
      sourceType: "TEMPLATE",
      entity: "MENTOR_REPORT",
      uploadedById: uploaderId,
    });
    await commitImportBatch(batchId);

    const scopedTo2026_1 = await prisma.riskAssessment.findMany({
      where: { scholarId: "BT-CO-001", semester: "2026-1", period: "MES 3" },
    });
    expect(scopedTo2026_1).toHaveLength(1);
    expect(scopedTo2026_1[0].globalRiskLevel).toBe("RIESGO_ALTO");
    expect(scopedTo2026_1[0].semester).toBe("2026-1");
  });

  it("idempotent re-import: same scholar/semester/period updates the same RiskAssessment row", async () => {
    const first = csvBuffer(
      "scholarId,reportingMonth,submissionId,mentorReportedGlobalStatus,semester\n" +
        "BT-CO-001,MES 4,sub-idem-risk-1,RIESGO ALTO,2026-1\n",
    );
    const { batchId: batch1 } = await createImportBatch({
      data: first,
      filename: "mentor.csv",
      sourceType: "TEMPLATE",
      entity: "MENTOR_REPORT",
      uploadedById: uploaderId,
    });
    await commitImportBatch(batch1);

    // A later sync of the SAME scholar/semester/period with an updated GLOBAL STATUS (a different
    // submissionId, as a re-sync of the same report would use if the sheet regenerated it).
    const second = csvBuffer(
      "scholarId,reportingMonth,submissionId,mentorReportedGlobalStatus,semester\n" +
        "BT-CO-001,MES 4,sub-idem-risk-2,RIESGO BAJO,2026-1\n",
    );
    const { batchId: batch2 } = await createImportBatch({
      data: second,
      filename: "mentor.csv",
      sourceType: "TEMPLATE",
      entity: "MENTOR_REPORT",
      uploadedById: uploaderId,
    });
    await commitImportBatch(batch2);

    expect(
      await prisma.riskAssessment.count({ where: { scholarId: "BT-CO-001", semester: "2026-1", period: "MES 4" } }),
    ).toBe(1);
    const risk = await prisma.riskAssessment.findUnique({
      where: { scholarId_semester_period: { scholarId: "BT-CO-001", semester: "2026-1", period: "MES 4" } },
    });
    expect(risk?.globalRiskLevel).toBe("RIESGO_BAJO"); // updated in place, not duplicated
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
