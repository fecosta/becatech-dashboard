// Transactional commit of a validated batch. Most rows are upserted in bulk by natural key
// (src/lib/data-import/bulk-upsert.ts) so we can (a) track which rows were *created* for
// insert-only rollback, and (b) collect the scholars/periods whose risk must be recomputed.
//
// SCHOLAR/ACADEMIC_TERM/MENTOR_REPORT/SUPPORT_ACTIVITY use the bulk path: these are the four
// entities the Google Sheets sync sends, at volumes (hundreds to thousands of rows per POST)
// where one findUnique + create/update per row — sequential round trips inside a single
// interactive transaction — blows past Prisma's transaction timeout (confirmed in production:
// ~75ms/round-trip meant 5,940 SUPPORT_ACTIVITY rows needed ~15 minutes the old way). The other
// three entities (MONTHLY_CHECKIN/SCHOLAR_REQUEST/FINANCIAL_INPUT) aren't part of that sync and
// haven't shown this problem at their typical volumes, so they keep the simpler per-row logic.
import { randomUUID } from "crypto";
import { bulkUpsert } from "./bulk-upsert";
import { prisma } from "../db";
import type { ImportEntity, ValidatedBatch } from "./types";

export interface CommitResult {
  /** table name → ids of rows this batch created (for rollback). */
  insertedRefs: Record<string, string[]>;
  successRows: number;
  riskScholarIds: string[];
  riskPeriods: string[];
  touchedRiskEntities: boolean;
}

export const RISK_ENTITIES: ImportEntity[] = [
  "ACADEMIC_TERM",
  "MONTHLY_CHECKIN",
  "MENTOR_REPORT",
  "SUPPORT_ACTIVITY",
];

export async function commitValidated(
  validated: ValidatedBatch,
  batchId: string,
): Promise<CommitResult> {
  const insertedRefs: Record<string, string[]> = {};
  const riskScholars = new Set<string>();
  const riskPeriods = new Set<string>();
  let touchedRiskEntities = false;
  let successRows = 0;

  const recordCreate = (table: string, id: string) => {
    (insertedRefs[table] ??= []).push(id);
  };

  await prisma.$transaction(
    async (tx) => {
      // Scholars first (dependents' FKs resolve within the txn).
      if (validated.SCHOLAR.length > 0) {
        const rows = validated.SCHOLAR.map((s) => ({ ...s, importBatchId: batchId, updatedAt: new Date() }));
        const results = await bulkUpsert(tx, "Scholar", "scholarId", ["scholarId"], rows);
        for (const r of results) if (r.wasInserted) recordCreate("Scholar", r.id);
        successRows += validated.SCHOLAR.length;
      }

      if (validated.ACADEMIC_TERM.length > 0) {
        const rows = validated.ACADEMIC_TERM.map((t) => ({
          ...t,
          id: randomUUID(),
          importBatchId: batchId,
          updatedAt: new Date(),
        }));
        const results = await bulkUpsert(tx, "AcademicTerm", "id", ["scholarId", "term"], rows);
        for (const r of results) if (r.wasInserted) recordCreate("AcademicTerm", r.id);
        for (const t of validated.ACADEMIC_TERM) riskScholars.add(t.scholarId);
        touchedRiskEntities = true;
        successRows += validated.ACADEMIC_TERM.length;
      }

      for (const c of validated.MONTHLY_CHECKIN) {
        const data = { ...c, importBatchId: batchId };
        const existing = await tx.monthlyCheckin.findUnique({
          where: { submissionId: c.submissionId },
          select: { id: true },
        });
        if (existing) await tx.monthlyCheckin.update({ where: { id: existing.id }, data });
        else recordCreate("MonthlyCheckin", (await tx.monthlyCheckin.create({ data, select: { id: true } })).id);
        riskScholars.add(c.scholarId);
        riskPeriods.add(c.reportingMonth);
        touchedRiskEntities = true;
        successRows += 1;
      }

      if (validated.MENTOR_REPORT.length > 0) {
        const rows = validated.MENTOR_REPORT.map((m) => ({ ...m, id: randomUUID(), importBatchId: batchId }));
        const results = await bulkUpsert(tx, "MentorReport", "id", ["submissionId"], rows);
        for (const r of results) if (r.wasInserted) recordCreate("MentorReport", r.id);
        for (const m of validated.MENTOR_REPORT) {
          riskScholars.add(m.scholarId);
          if (m.reportingMonth) riskPeriods.add(m.reportingMonth);
        }
        touchedRiskEntities = true;
        successRows += validated.MENTOR_REPORT.length;
      }

      if (validated.SUPPORT_ACTIVITY.length > 0) {
        const rows = validated.SUPPORT_ACTIVITY.map((a) => ({
          ...a,
          source: a.source ?? "import",
          id: randomUUID(),
          importBatchId: batchId,
        }));
        const results = await bulkUpsert(
          tx,
          "SupportActivity",
          "id",
          ["scholarId", "period", "activityType", "source"],
          rows,
        );
        for (const r of results) if (r.wasInserted) recordCreate("SupportActivity", r.id);
        for (const a of validated.SUPPORT_ACTIVITY) {
          riskScholars.add(a.scholarId);
          riskPeriods.add(a.period);
        }
        touchedRiskEntities = true;
        successRows += validated.SUPPORT_ACTIVITY.length;
      }

      for (const r of validated.SCHOLAR_REQUEST) {
        const data = { ...r, importBatchId: batchId };
        const existing = await tx.scholarRequest.findUnique({
          where: { submissionId: r.submissionId },
          select: { id: true },
        });
        if (existing) await tx.scholarRequest.update({ where: { id: existing.id }, data });
        else recordCreate("ScholarRequest", (await tx.scholarRequest.create({ data, select: { id: true } })).id);
        successRows += 1;
      }

      for (const f of validated.FINANCIAL_INPUT) {
        const data = { ...f, importBatchId: batchId };
        // No DB unique on FinancialInput — dedup by its logical natural key.
        const existing = await tx.financialInput.findFirst({
          where: {
            scholarId: f.scholarId,
            period: f.period,
            costCategory: f.costCategory,
            currency: f.currency,
          },
          select: { id: true },
        });
        if (existing) await tx.financialInput.update({ where: { id: existing.id }, data });
        else recordCreate("FinancialInput", (await tx.financialInput.create({ data, select: { id: true } })).id);
        successRows += 1;
      }
    },
    { timeout: 60_000 },
  );

  return {
    insertedRefs,
    successRows,
    riskScholarIds: [...riskScholars],
    riskPeriods: [...riskPeriods],
    touchedRiskEntities,
  };
}
