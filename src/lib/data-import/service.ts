// Orchestrates the import pipeline: create+validate a batch (preview, no target writes),
// then commit it (transactional upsert → data-quality scan → risk recompute).
import type { Prisma } from "../../generated/prisma/client";
import type { DataImportSourceType } from "../../generated/prisma/enums";
import { runDataQualityScan } from "../data-quality/checks";
import { prisma } from "../db";
import { recomputeRiskForScholars } from "../risk/recompute";
import { legacyAdapter } from "./adapters/legacy";
import { templateAdapter } from "./adapters/template";
import { type CommitResult, commitValidated } from "./commit";
import { parseWorkbook } from "./parse";
import {
  type CanonicalBatch,
  emptyValidatedBatch,
  type ImportEntity,
  type ValidatedBatch,
  type ValidationContext,
  type ValidationResult,
} from "./types";
import { validateBatch } from "./validate";

async function loadValidationContext(): Promise<ValidationContext> {
  const [scholars, controls] = await Promise.all([
    prisma.scholar.findMany({ select: { scholarId: true } }),
    prisma.controlValue.findMany({ where: { isActive: true }, select: { category: true, value: true } }),
  ]);
  const controlMap = new Map<string, Set<string>>();
  for (const c of controls) {
    let set = controlMap.get(c.category);
    if (!set) {
      set = new Set<string>();
      controlMap.set(c.category, set);
    }
    set.add(c.value);
  }
  return {
    existingScholarIds: new Set(scholars.map((s) => s.scholarId)),
    controls: controlMap,
  };
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
): Promise<{ batchId: string; result: ValidationResult }> {
  const sheets = parseWorkbook(input.data);

  let canonical: CanonicalBatch;
  if (input.sourceType === "TEMPLATE") {
    if (!input.entity) throw new Error("An entity is required for TEMPLATE imports.");
    canonical = templateAdapter(input.entity, sheets[0]?.records ?? []);
  } else {
    canonical = legacyAdapter(sheets);
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

  return { batchId: batch.id, result };
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

    let recomputed = 0;
    if (commit.touchedRiskEntities) {
      recomputed = await recomputeRiskForScholars(commit.riskScholarIds, commit.riskPeriods);
    }

    await prisma.dataImportBatch.update({
      where: { id: batchId },
      data: {
        status: "COMMITTED",
        successRows: commit.successRows,
        insertedRefs: commit.insertedRefs as Prisma.InputJsonValue,
        triggeredRiskRecompute: commit.touchedRiskEntities,
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
