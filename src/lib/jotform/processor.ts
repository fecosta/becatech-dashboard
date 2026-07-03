// Store a raw JotForm submission, map it to the right table, dedup by submissionId,
// and record the processing status (PROCESSED / FAILED / IGNORED). Placeholder — no
// live JotForm credentials are used.
import type { Prisma } from "../../generated/prisma/client";
import { ProcessingStatus } from "../../generated/prisma/enums";
import { prisma } from "../db";
import { mapSubmission } from "./mapper";
import type { ProcessResult, RawJotformPayload } from "./types";

async function markRaw(id: string, status: ProcessingStatus, error?: string) {
  await prisma.rawJotformSubmission.update({
    where: { id },
    data: { processingStatus: status, processingError: error ?? null, processedAt: new Date() },
  });
}

export async function processSubmission(payload: RawJotformPayload): Promise<ProcessResult> {
  const submissionId = payload.submissionId;
  if (!submissionId) {
    return { submissionId: "", status: "FAILED", error: "Missing submissionId" };
  }

  // Duplicate protection: a submission we have already stored is ignored.
  const existing = await prisma.rawJotformSubmission.findUnique({ where: { submissionId } });
  if (existing) {
    return { submissionId, status: "IGNORED", duplicate: true };
  }

  const raw = await prisma.rawJotformSubmission.create({
    data: {
      submissionId,
      formId: payload.formId || "unknown",
      formName: payload.formName ?? null,
      submittedAt: payload.submittedAt ? new Date(payload.submittedAt) : null,
      payloadJson: payload as unknown as Prisma.InputJsonValue,
      processingStatus: ProcessingStatus.PENDING,
    },
  });

  try {
    const mapped = mapSubmission(payload);
    if (!mapped) {
      await markRaw(raw.id, ProcessingStatus.IGNORED, "Unknown form type");
      return { submissionId, status: "IGNORED", error: "Unknown form type" };
    }

    const scholarId = mapped.data.scholarId;
    if (!scholarId) {
      await markRaw(raw.id, ProcessingStatus.FAILED, "Missing scholarId");
      return { submissionId, status: "FAILED", error: "Missing scholarId" };
    }
    const scholar = await prisma.scholar.findUnique({
      where: { scholarId },
      select: { scholarId: true },
    });
    if (!scholar) {
      await markRaw(raw.id, ProcessingStatus.FAILED, `Scholar ${scholarId} not found`);
      return { submissionId, status: "FAILED", error: `Scholar ${scholarId} not found` };
    }

    let recordId: string;
    if (mapped.target === "MonthlyCheckin") {
      const rec = await prisma.monthlyCheckin.create({
        data: { ...mapped.data, rawSubmissionId: raw.id },
      });
      recordId = rec.id;
    } else if (mapped.target === "MentorReport") {
      const rec = await prisma.mentorReport.create({
        data: { ...mapped.data, rawSubmissionId: raw.id },
      });
      recordId = rec.id;
    } else {
      const rec = await prisma.scholarRequest.create({ data: mapped.data });
      recordId = rec.id;
    }

    await markRaw(raw.id, ProcessingStatus.PROCESSED);
    return { submissionId, status: "PROCESSED", target: mapped.target, recordId };
  } catch (error) {
    const code = (error as { code?: string }).code;
    if (code === "P2002") {
      // The target already has this submissionId — treat as a duplicate.
      await markRaw(raw.id, ProcessingStatus.IGNORED, "Duplicate submissionId in target table");
      return { submissionId, status: "IGNORED", duplicate: true };
    }
    const message = error instanceof Error ? error.message : String(error);
    await markRaw(raw.id, ProcessingStatus.FAILED, message);
    return { submissionId, status: "FAILED", error: message };
  }
}
