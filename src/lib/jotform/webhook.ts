// Placeholder JotForm webhook handler: normalize the incoming body then process it.
// Accepts our normalized shape and tolerates JotForm's native key casing.
import { processSubmission } from "./processor";
import type { JotformFormType, ProcessResult, RawJotformPayload } from "./types";

export async function handleJotformWebhook(input: unknown): Promise<ProcessResult> {
  const payload = normalizePayload(input);
  if (!payload) {
    return { submissionId: "", status: "FAILED", error: "Invalid payload" };
  }
  return processSubmission(payload);
}

function pickString(o: Record<string, unknown>, ...keys: string[]): string | undefined {
  for (const k of keys) {
    if (typeof o[k] === "string" && o[k]) return o[k] as string;
  }
  return undefined;
}

function normalizePayload(input: unknown): RawJotformPayload | null {
  if (!input || typeof input !== "object") return null;
  const o = input as Record<string, unknown>;

  const submissionId = pickString(o, "submissionId", "submissionID");
  if (!submissionId) return null;

  return {
    submissionId,
    formId: pickString(o, "formId", "formID") ?? "unknown",
    formName: pickString(o, "formName", "formTitle"),
    formType: typeof o.formType === "string" ? (o.formType as JotformFormType) : undefined,
    submittedAt: pickString(o, "submittedAt", "created_at"),
    data: o.data && typeof o.data === "object" ? (o.data as Record<string, unknown>) : {},
  };
}
