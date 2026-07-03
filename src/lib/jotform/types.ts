// Types for the placeholder JotForm ingestion service (brief §14).
// The MVP does not call the live JotForm API; we accept a normalized payload whose
// `data` already holds named fields (a real integration would map question ids here).
import type { Prisma } from "../../generated/prisma/client";

export type JotformFormType = "CHECKIN" | "MENTOR_REPORT" | "SCHOLAR_REQUEST" | "UNKNOWN";

export interface RawJotformPayload {
  submissionId: string;
  formId: string;
  formName?: string;
  /** Explicit type wins; otherwise it is inferred from the form name/id. */
  formType?: JotformFormType;
  submittedAt?: string;
  data: Record<string, unknown>;
}

export type MappedRecord =
  | { target: "MonthlyCheckin"; data: Prisma.MonthlyCheckinUncheckedCreateInput }
  | { target: "MentorReport"; data: Prisma.MentorReportUncheckedCreateInput }
  | { target: "ScholarRequest"; data: Prisma.ScholarRequestUncheckedCreateInput };

export interface ProcessResult {
  submissionId: string;
  status: "PROCESSED" | "FAILED" | "IGNORED";
  target?: MappedRecord["target"];
  recordId?: string;
  duplicate?: boolean;
  error?: string;
}
