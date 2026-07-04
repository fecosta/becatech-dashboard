import { afterAll, beforeEach, describe, expect, it } from "vitest";
import {
  commitImportBatch,
  createImportBatch,
  rollbackImportBatch,
} from "@/lib/data-import/service";
import { prisma } from "@/lib/db";
import { csvBuffer, resetDb, seedFixture, xlsxBuffer } from "./helpers";

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
