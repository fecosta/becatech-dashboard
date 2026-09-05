// Orchestrates the import pipeline: create+validate a batch (preview, no target writes),
// then commit it (transactional upsert → data-quality scan → risk recompute).
import type { Prisma } from "../../generated/prisma/client";
import type { DataImportSourceType } from "../../generated/prisma/enums";
import { runDataQualityScan } from "../data-quality/checks";
import { prisma } from "../db";
import { legacyAdapter } from "./adapters/legacy";
import { mentorReportsAdapter } from "./adapters/mentor-reports";
import { scholarGeneralInfoAdapter } from "./adapters/scholar-general-info";
import { templateAdapter } from "./adapters/template";
import { type CommitResult, commitValidated } from "./commit";
import type { ParsedSheet } from "./parse";
import { parseWorkbook } from "./parse";
import {
  type CanonicalBatch,
  emptyValidatedBatch,
  type ImportEntity,
  type SourceSchemaReport,
  type ValidatedBatch,
  type ValidationResult,
} from "./types";
import { validateBatch } from "./validate";
import { loadValidationContext } from "./validation-context";

export interface NamedSchemaReport extends SourceSchemaReport {
  /** Which sheet this report is for, e.g. "SCHOLAR GENERAL INFO.csv#1" — not a new stored entity,
   *  just enough for the admin preview UI / sync-route logs to say which sheet a warning is about. */
  sheetName: string;
  source: string;
}

/** Schema-drift report per recognized sheet, for a raw (LEGACY_WIDE_EXCEL) upload — one of the two
 *  first-class operational adapters (Scholar General Info, Mentor Reports) that declare a source
 *  contract. Purely informational (never blocks a commit): row-level validation already produces
 *  an explicit error for a missing required *field* (e.g. "University not found"); this is the
 *  column-level view of the same sheet, surfaced for the admin preview UI and sync-route logs. */
function inspectLegacySheets(sheets: ParsedSheet[]): NamedSchemaReport[] {
  const reports: NamedSchemaReport[] = [];
  for (const sheet of sheets) {
    if (scholarGeneralInfoAdapter.canHandle(sheet)) {
      reports.push({
        sheetName: sheet.sheetName,
        source: scholarGeneralInfoAdapter.source,
        ...scholarGeneralInfoAdapter.inspectSchema!(sheet),
      });
    } else if (mentorReportsAdapter.canHandle(sheet)) {
      reports.push({
        sheetName: sheet.sheetName,
        source: mentorReportsAdapter.source,
        ...mentorReportsAdapter.inspectSchema!(sheet),
      });
    }
  }
  return reports;
}

export interface CreateBatchInput {
  data: ArrayBuffer | Uint8Array;
  filename: string;
  sourceType: DataImportSourceType;
  entity?: ImportEntity;
  uploadedById: string;
}

/** Parse + validate an upload and persist it as a VALIDATED batch (no target writes yet). */
export async function createImportBatch(
  input: CreateBatchInput,
): Promise<{ batchId: string; result: ValidationResult; schemaReports: NamedSchemaReport[] }> {
  const sheets = parseWorkbook(input.data);

  let canonical: CanonicalBatch;
  let schemaReports: NamedSchemaReport[] = [];
  if (input.sourceType === "TEMPLATE") {
    if (!input.entity) throw new Error("An entity is required for TEMPLATE imports.");
    canonical = templateAdapter(input.entity, sheets[0]?.records ?? []);
  } else {
    canonical = legacyAdapter(sheets);
    schemaReports = inspectLegacySheets(sheets);
  }

  // Informational only (see inspectLegacySheets) — never blocks ingestion. Logged the same way
  // Apps Script logs an unrecognized-column WARN to its Sync Log, so an unexpected sheet change is
  // visible in server logs even on the automated sync path, which has no UI to render a warning in.
  for (const report of schemaReports) {
    if (report.unknown.length > 0) {
      console.warn(`[data-import] ${report.source} (${report.sheetName}): unrecognized columns: ${report.unknown.join(", ")}`);
    }
    if (report.missingRequired.length > 0) {
      console.warn(`[data-import] ${report.source} (${report.sheetName}): missing expected columns: ${report.missingRequired.join(", ")}`);
    }
  }

  const ctx = await loadValidationContext();
  const result = validateBatch(canonical, ctx);

  const batch = await prisma.dataImportBatch.create({
    data: {
      sourceType: input.sourceType,
      entities: result.entities,
      filename: input.filename,
      uploadedById: input.uploadedById,
      status: "VALIDATED",
      totalRows: result.totalRows,
      successRows: result.successRows,
      errorRows: result.errorRows,
      parsedRows: result.validated as unknown as Prisma.InputJsonValue,
      errorReport: result.errors as unknown as Prisma.InputJsonValue,
    },
    select: { id: true },
  });

  return { batchId: batch.id, result, schemaReports };
}

export interface CommitOutcome {
  commit: CommitResult;
  recomputed: number;
}

/** Commit a validated batch: upsert rows, then run the data-quality scan and risk recompute. */
export async function commitImportBatch(batchId: string): Promise<CommitOutcome> {
  const batch = await prisma.dataImportBatch.findUnique({ where: { id: batchId } });
  if (!batch) throw new Error("Import batch not found.");
  if (batch.status !== "VALIDATED") {
    throw new Error(`Batch is ${batch.status}; only VALIDATED batches can be committed.`);
  }

  const validated = {
    ...emptyValidatedBatch(),
    ...((batch.parsedRows as unknown as Partial<ValidatedBatch> | null) ?? {}),
  } as ValidatedBatch;

  try {
    const commit = await commitValidated(validated, batchId);
    await runDataQualityScan({ persist: true });

    // Risk is no longer derived — global risk is INGESTED from the SUPPORT ACTIVITY LOG
    // (MONTHLY_STATUS → RiskAssessment). No import recomputes risk anymore; the derive engine
    // (src/lib/risk/derive.ts, recompute.ts) is retained but intentionally unwired here.
    const recomputed = 0;

    await prisma.dataImportBatch.update({
      where: { id: batchId },
      data: {
        status: "COMMITTED",
        successRows: commit.successRows,
        insertedRefs: commit.insertedRefs as Prisma.InputJsonValue,
        triggeredRiskRecompute: false,
      },
    });

    return { commit, recomputed };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const existing = Array.isArray(batch.errorReport) ? (batch.errorReport as unknown[]) : [];
    await prisma.dataImportBatch.update({
      where: { id: batchId },
      data: {
        status: "FAILED",
        errorReport: [...existing, { message }] as unknown as Prisma.InputJsonValue,
      },
    });
    throw error;
  }
}

export interface IngestResult {
  batchId: string;
  result: ValidationResult;
  commit: CommitOutcome;
}

/** Parse+validate+commit in one call — what the automated Google Sheets sync needs (no human
 *  preview step); manual imports keep using createImportBatch/commitImportBatch separately so the
 *  admin UI can show a preview before committing. Pure composition, same behavior as calling both
 *  in sequence — returns both the validation result (entities/row counts/errors) and the commit
 *  outcome, since the sync route's response needs both. */
export async function ingestAndCommit(input: CreateBatchInput): Promise<IngestResult> {
  const { batchId, result } = await createImportBatch(input);
  const commit = await commitImportBatch(batchId);
  return { batchId, result, commit };
}

export function listImportBatches() {
  return prisma.dataImportBatch.findMany({
    orderBy: { uploadedAt: "desc" },
    take: 100,
    select: {
      id: true,
      filename: true,
      sourceType: true,
      entities: true,
      status: true,
      totalRows: true,
      successRows: true,
      errorRows: true,
      triggeredRiskRecompute: true,
      rolledBackAt: true,
      uploadedAt: true,
      uploadedBy: { select: { fullName: true, email: true } },
    },
  });
}

export function getImportBatchDetail(id: string) {
  return prisma.dataImportBatch.findUnique({
    where: { id },
    include: { uploadedBy: { select: { fullName: true, email: true } } },
  });
}

/** Insert-only rollback: delete the rows this batch created (updates are not reverted). */
export async function rollbackImportBatch(id: string): Promise<{ deleted: number }> {
  const batch = await prisma.dataImportBatch.findUnique({ where: { id } });
  if (!batch) throw new Error("Import batch not found.");
  if (batch.status !== "COMMITTED") throw new Error("Only committed batches can be rolled back.");
  if (batch.rolledBackAt) throw new Error("This batch has already been rolled back.");

  const refs = (batch.insertedRefs as Record<string, string[]> | null) ?? {};
  let deleted = 0;

  await prisma.$transaction(
    async (tx) => {
      const del = async (ids: string[] | undefined, fn: (ids: string[]) => Promise<{ count: number }>) => {
        if (ids && ids.length > 0) deleted += (await fn(ids)).count;
      };
      // Child → parent order; deleting a created Scholar cascades to any of its rows.
      await del(refs.FinancialInput, (ids) => tx.financialInput.deleteMany({ where: { id: { in: ids } } }));
      await del(refs.ScholarRequest, (ids) => tx.scholarRequest.deleteMany({ where: { id: { in: ids } } }));
      await del(refs.SupportActivity, (ids) => tx.supportActivity.deleteMany({ where: { id: { in: ids } } }));
      await del(refs.MentorReport, (ids) => tx.mentorReport.deleteMany({ where: { id: { in: ids } } }));
      await del(refs.MonthlyCheckin, (ids) => tx.monthlyCheckin.deleteMany({ where: { id: { in: ids } } }));
      await del(refs.AcademicTerm, (ids) => tx.academicTerm.deleteMany({ where: { id: { in: ids } } }));
      await del(refs.Scholar, (ids) => tx.scholar.deleteMany({ where: { scholarId: { in: ids } } }));
    },
    { timeout: 60_000 },
  );

  await prisma.dataImportBatch.update({ where: { id }, data: { rolledBackAt: new Date() } });
  await runDataQualityScan({ persist: true });
  return { deleted };
}
