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
import type { Prisma } from "../../generated/prisma/client";
import { mentorReportToRisk } from "../risk/from-mentor-report";
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
        const rows = validated.SCHOLAR.map((s) => ({
          ...s,
          // Explicit default, not left to Postgres's column default — a raw multi-row INSERT
          // can't say "omit this column, use its default" per row (see bulk-upsert.ts).
          programStatus: s.programStatus ?? "ACTIVE",
          importBatchId: batchId,
          updatedAt: new Date(),
        }));
        const results = await bulkUpsert(tx, "Scholar", "scholarId", ["scholarId"], rows);
        for (const r of results) if (r.wasInserted) recordCreate("Scholar", r.id);
        successRows += validated.SCHOLAR.length;
      }

      if (validated.ACADEMIC_TERM.length > 0) {
        const rows = validated.ACADEMIC_TERM.map((t) => ({
          ...t,
          isLeveling: t.isLeveling ?? false,
          receivedSupport: t.receivedSupport ?? false,
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
        const rows = validated.MENTOR_REPORT.map((m) => ({
          ...m,
          individualTutoring: m.individualTutoring ?? 0,
          groupTutoring: m.groupTutoring ?? 0,
          individualMentoring: m.individualMentoring ?? 0,
          groupMentoring: m.groupMentoring ?? 0,
          workshops: m.workshops ?? 0,
          id: randomUUID(),
          importBatchId: batchId,
        }));
        const results = await bulkUpsert(tx, "MentorReport", "id", ["submissionId"], rows);
        for (const r of results) if (r.wasInserted) recordCreate("MentorReport", r.id);

        // Ingest the authoritative risk from each report's GLOBAL STATUS (col Y) → RiskAssessment,
        // keyed by the program month (MES n). Dedupe by [scholarId, period] — a scholar may have >1
        // report in a MES; keep the last, since bulkUpsert can't touch the same conflict key twice
        // in one statement. Unclassified reports (blank/unparseable GLOBAL STATUS, non-MES month)
        // map to null and are skipped.
        const riskByKey = new Map<string, Prisma.RiskAssessmentUncheckedCreateInput>();
        for (const m of validated.MENTOR_REPORT) {
          const risk = mentorReportToRisk(m);
          if (risk) riskByKey.set(`${risk.scholarId}::${risk.period}`, risk);
        }
        if (riskByKey.size > 0) {
          const riskRows = [...riskByKey.values()].map((r) => ({
            ...r,
            id: randomUUID(),
            updatedAt: new Date(),
          }));
          const riskRes = await bulkUpsert(tx, "RiskAssessment", "id", ["scholarId", "period"], riskRows);
          for (const r of riskRes) if (r.wasInserted) recordCreate("RiskAssessment", r.id);
        }
        successRows += validated.MENTOR_REPORT.length;
      }

      if (validated.MONTHLY_STATUS.length > 0) {
        // Manual risk-classification import → RiskAssessment. Upsert on the natural key
        // [scholarId, period]; dedupe first (bulkUpsert can't touch the same conflict key twice in
        // one statement). RiskAssessment has no importBatchId, so these rows aren't
        // insert-rollback-tracked (acceptable: they're a mirror of the sheet, re-set on next sync).
        const byKey = new Map<string, (typeof validated.MONTHLY_STATUS)[number]>();
        for (const r of validated.MONTHLY_STATUS) byKey.set(`${r.scholarId}::${r.period}`, r);
        const rows = [...byKey.values()].map((r) => ({
          ...r,
          id: randomUUID(),
          updatedAt: new Date(),
        }));
        const results = await bulkUpsert(tx, "RiskAssessment", "id", ["scholarId", "period"], rows);
        for (const r of results) if (r.wasInserted) recordCreate("RiskAssessment", r.id);
        successRows += rows.length;
      }

      if (validated.SUPPORT_ACTIVITY.length > 0) {
        const rows = validated.SUPPORT_ACTIVITY.map((a) => ({
          ...a,
          activityCount: a.activityCount ?? 0,
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
        // SUPPORT ACTIVITY LOG is deprecated and no longer feeds the risk engine (participation is
        // sourced from MENTOR REPORTS counts). Rows are still upserted for backward compatibility,
        // but importing them must NOT trigger a risk recompute: its `MES` date-cell `period` values
        // are not real months and previously rewrote risk into junk (non-YYYY-MM) periods.
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
