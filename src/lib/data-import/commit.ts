// Transactional commit of a validated batch. Each row is upserted by its natural key
// (find-then-create/update) so we can (a) track which rows were *created* for insert-only
// rollback, and (b) collect the scholars/periods whose risk must be recomputed.
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
      for (const s of validated.SCHOLAR) {
        const data = { ...s, importBatchId: batchId };
        const existing = await tx.scholar.findUnique({
          where: { scholarId: s.scholarId },
          select: { scholarId: true },
        });
        if (existing) await tx.scholar.update({ where: { scholarId: s.scholarId }, data });
        else {
          await tx.scholar.create({ data });
          recordCreate("Scholar", s.scholarId);
        }
        successRows += 1;
      }

      for (const t of validated.ACADEMIC_TERM) {
        const data = { ...t, importBatchId: batchId };
        const existing = await tx.academicTerm.findUnique({
          where: { scholarId_term: { scholarId: t.scholarId, term: t.term } },
          select: { id: true },
        });
        if (existing) await tx.academicTerm.update({ where: { id: existing.id }, data });
        else recordCreate("AcademicTerm", (await tx.academicTerm.create({ data, select: { id: true } })).id);
        riskScholars.add(t.scholarId);
        touchedRiskEntities = true;
        successRows += 1;
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

      for (const m of validated.MENTOR_REPORT) {
        const data = { ...m, importBatchId: batchId };
        const existing = await tx.mentorReport.findUnique({
          where: { submissionId: m.submissionId },
          select: { id: true },
        });
        if (existing) await tx.mentorReport.update({ where: { id: existing.id }, data });
        else recordCreate("MentorReport", (await tx.mentorReport.create({ data, select: { id: true } })).id);
        riskScholars.add(m.scholarId);
        if (m.reportingMonth) riskPeriods.add(m.reportingMonth);
        touchedRiskEntities = true;
        successRows += 1;
      }

      for (const a of validated.SUPPORT_ACTIVITY) {
        const source = a.source ?? "import";
        const data = { ...a, source, importBatchId: batchId };
        const existing = await tx.supportActivity.findUnique({
          where: {
            scholarId_period_activityType_source: {
              scholarId: a.scholarId,
              period: a.period,
              activityType: a.activityType,
              source,
            },
          },
          select: { id: true },
        });
        if (existing) await tx.supportActivity.update({ where: { id: existing.id }, data });
        else recordCreate("SupportActivity", (await tx.supportActivity.create({ data, select: { id: true } })).id);
        riskScholars.add(a.scholarId);
        riskPeriods.add(a.period);
        touchedRiskEntities = true;
        successRows += 1;
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
