import { afterAll, beforeEach, describe, expect, it } from "vitest";
import {
  commitImportBatch,
  createImportBatch,
  rollbackImportBatch,
} from "@/lib/data-import/service";
import { getRiskStageSummary } from "@/lib/dashboard/queries";
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

  it("check-in import recomputes risk for that month", async () => {
    const data = csvBuffer("scholarId,reportingMonth,finalStatus\nBT-CO-001,2026-06,En riesgo\n");
    const { batchId } = await createImportBatch({
      data,
      filename: "checkin.csv",
      sourceType: "TEMPLATE",
      entity: "MONTHLY_CHECKIN",
      uploadedById: uploaderId,
    });
    const { commit, recomputed } = await commitImportBatch(batchId);
    expect(commit.touchedRiskEntities).toBe(true);
    expect(recomputed).toBeGreaterThanOrEqual(1);

    const risk = await prisma.riskAssessment.findUnique({
      where: { scholarId_period: { scholarId: "BT-CO-001", period: "2026-06" } },
    });
    expect(risk?.source).toBe("import-recompute");
    expect(risk?.psychosocialRiskValue).toBe(3); // "En riesgo" → 3

    // The seed scholar has NO support-activity rows and NO academic term for this period, so both
    // dimensions are "not assessed" (null) — they must NOT be inferred as 0→4→CRITICO. Global risk
    // is driven only by the present psychosocial signal (3 = RIESGO_ALTO), never CRITICO, and the
    // assessment is flagged incomplete so the UI can show "Insufficient Data" instead of a fake 0.
    expect(risk?.globalRiskValue).toBe(3);
    expect(risk?.globalRiskLevel).toBe("RIESGO_ALTO");
    expect(risk?.participationRiskValue).toBe(0); // stored as 0 = did not contribute to the max
    expect(risk?.assessmentComplete).toBe(false);
    expect(risk?.missingInputs).toEqual(expect.arrayContaining(["academic", "participation"]));
    expect(risk?.missingInputs).not.toContain("psychosocial");

    // The stage summary surfaces this as "Insufficient data", kept out of the critical/high count.
    const summary = await getRiskStageSummary({});
    expect(summary.insufficientDataCount).toBeGreaterThanOrEqual(1);
    expect(summary.distribution.CRITICO).toBe(0);
  });

  it("derives participation risk from mentor-report activity counts (not the deprecated log)", async () => {
    // A mentor report with 6 logged activities (3+1+0+0+2) → participation risk 0. Proves
    // participation now comes from mentor-report counts and is assessed (not the old zero-support
    // path). No academic term / psychosocial signal → those stay not-assessed.
    const data = csvBuffer(
      "scholarId,reportingMonth,submissionId,individualTutoring,groupTutoring,individualMentoring,groupMentoring,workshops\n" +
        "BT-CO-001,2026-06,sub-part-1,3,1,0,0,2\n",
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
      where: { scholarId_period: { scholarId: "BT-CO-001", period: "2026-06" } },
    });
    expect(risk?.participationRiskValue).toBe(0);
    expect(risk?.missingInputs).not.toContain("participation");
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

  it("recompute fallback targets the latest real month, never a legacy junk period", async () => {
    // Seed a corrupted legacy period ("MES 7") alongside a real month ("2026-06"). "MES 7" sorts
    // lexically ABOVE "2026-06" ('M' > '2'), so a naive max(period) fallback would resurrect it.
    const base = {
      academicRiskLevel: "SIN_RIESGO" as const,
      academicRiskValue: 0,
      psychosocialRiskLevel: "SIN_RIESGO" as const,
      psychosocialRiskValue: 0,
      participationRiskLevel: "SIN_RIESGO" as const,
      participationRiskValue: 0,
      globalRiskLevel: "SIN_RIESGO" as const,
      globalRiskValue: 0,
      source: "seed",
    };
    await prisma.riskAssessment.createMany({
      data: [
        { scholarId: "BT-CO-001", period: "MES 7", ...base },
        { scholarId: "BT-CO-001", period: "2026-06", ...base },
      ],
    });

    // An academic-term import contributes no period of its own → recompute falls back to the
    // scholar's latest existing period, which must be the real month, not the junk label.
    const data = csvBuffer("scholarId,term,gpa,failedSubjectsCount\nBT-CO-001,2025-1,2.0,2\n");
    const { batchId } = await createImportBatch({
      data,
      filename: "terms.csv",
      sourceType: "TEMPLATE",
      entity: "ACADEMIC_TERM",
      uploadedById: uploaderId,
    });
    await commitImportBatch(batchId);

    const real = await prisma.riskAssessment.findUnique({
      where: { scholarId_period: { scholarId: "BT-CO-001", period: "2026-06" } },
    });
    const junk = await prisma.riskAssessment.findUnique({
      where: { scholarId_period: { scholarId: "BT-CO-001", period: "MES 7" } },
    });
    expect(real?.source).toBe("import-recompute"); // real month recomputed
    expect(junk?.source).toBe("seed"); // junk period left untouched — never resurrected
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
