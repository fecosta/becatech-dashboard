// Map a JotForm payload to a target-table create input. Field mapping is name-based
// here (placeholder); a live integration would translate JotForm question ids first.
import type { Country } from "../../generated/prisma/enums";
import type { JotformFormType, MappedRecord, RawJotformPayload } from "./types";

const str = (v: unknown): string => (v == null ? "" : String(v));
const opt = (v: unknown): string | null => {
  const s = v == null ? "" : String(v).trim();
  return s === "" ? null : s;
};
const int = (v: unknown): number | null => {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : null;
};
const dt = (v: unknown): Date | null => {
  if (v == null || v === "") return null;
  const d = new Date(String(v));
  return Number.isNaN(d.getTime()) ? null : d;
};
const country = (v: unknown): Country | null => (v === "COLOMBIA" || v === "PERU" ? v : null);

export function resolveFormType(payload: RawJotformPayload): JotformFormType {
  if (payload.formType) return payload.formType;
  const hay = `${payload.formName ?? ""} ${payload.formId ?? ""}`.toLowerCase();
  if (hay.includes("mentor")) return "MENTOR_REPORT";
  if (hay.includes("request") || hay.includes("solicitud")) return "SCHOLAR_REQUEST";
  if (hay.includes("checkin") || hay.includes("check-in") || hay.includes("bienestar") || hay.includes("wellbeing")) {
    return "CHECKIN";
  }
  return "UNKNOWN";
}

export function mapSubmission(payload: RawJotformPayload): MappedRecord | null {
  const d = payload.data;
  const submissionId = payload.submissionId;
  const submittedAt = dt(d.submissionDate) ?? dt(payload.submittedAt);

  switch (resolveFormType(payload)) {
    case "CHECKIN":
      return {
        target: "MonthlyCheckin",
        data: {
          scholarId: str(d.scholarId),
          submissionId,
          reportingMonth: str(d.reportingMonth),
          country: country(d.country),
          cohort: opt(d.cohort),
          university: opt(d.university),
          submissionDate: submittedAt,
          scholarName: opt(d.scholarName),
          academicSelfReport: opt(d.academicSelfReport),
          academicLevel: opt(d.academicLevel),
          emotionalSelfReport: opt(d.emotionalSelfReport),
          psychosocialLevel: opt(d.psychosocialLevel),
          externalFactorReport: opt(d.externalFactorReport),
          externalFactorLevel: opt(d.externalFactorLevel),
          finalStatus: opt(d.finalStatus),
          sourceForm: payload.formName ?? "jotform_checkin",
        },
      };

    case "MENTOR_REPORT":
      return {
        target: "MentorReport",
        data: {
          scholarId: str(d.scholarId),
          submissionId,
          scholarName: opt(d.scholarName),
          mentorName: opt(d.mentorName),
          country: country(d.country),
          cohort: opt(d.cohort),
          university: opt(d.university),
          reportingMonth: opt(d.reportingMonth),
          registrationDate: dt(d.registrationDate) ?? submittedAt,
          sessionDate: dt(d.sessionDate),
          sessionType: opt(d.sessionType),
          sessionSummary: opt(d.sessionSummary),
          permanenceRisk: opt(d.permanenceRisk),
          academicStatus: opt(d.academicStatus),
          approvedCoursesCount: int(d.approvedCoursesCount),
          atRiskCoursesCount: int(d.atRiskCoursesCount),
          psychosocialStatus: opt(d.psychosocialStatus),
          accompanimentPlan: opt(d.accompanimentPlan),
          nextSteps: opt(d.nextSteps),
        },
      };

    case "SCHOLAR_REQUEST":
      return {
        target: "ScholarRequest",
        data: {
          scholarId: str(d.scholarId),
          submissionId,
          submissionDate: submittedAt,
          country: country(d.country),
          cohort: opt(d.cohort),
          university: opt(d.university),
          firstName: opt(d.firstName),
          lastName: opt(d.lastName),
          requestType: str(d.requestType) || "Other",
          requestDescription: opt(d.requestDescription),
          context: opt(d.context),
          responseChannel: opt(d.responseChannel),
        },
      };

    default:
      return null;
  }
}
