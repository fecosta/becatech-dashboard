// Human-readable (English) labels and colors for enum values, used by the UI.
import type {
  AcademicProgressStatus,
  ActivityType,
  AlertType,
  Country,
  ProgramStatus,
  RequestStatus,
  ReviewStatus,
  RiskChangeLabel,
  RiskLevel,
  SelectionStage,
} from "@/generated/prisma/enums";

export const COUNTRY_LABEL: Record<Country, string> = {
  COLOMBIA: "Colombia",
  PERU: "Peru",
};

export const PROGRAM_STATUS_LABEL: Record<ProgramStatus, string> = {
  ACTIVE: "Active",
  WITHDRAWN: "Withdrawn",
  GRADUATED: "Graduated",
  PAUSED: "Paused",
};

export const RISK_LEVEL_LABEL: Record<RiskLevel, string> = {
  SIN_RIESGO: "No risk",
  RIESGO_BAJO: "Low risk",
  RIESGO_MEDIO: "Medium risk",
  RIESGO_ALTO: "High risk",
  CRITICO: "Critical",
};

export const RISK_LEVEL_ORDER: RiskLevel[] = [
  "SIN_RIESGO",
  "RIESGO_BAJO",
  "RIESGO_MEDIO",
  "RIESGO_ALTO",
  "CRITICO",
];

/** Tailwind classes for a risk badge. */
export const RISK_LEVEL_CLASS: Record<RiskLevel, string> = {
  SIN_RIESGO: "bg-emerald-100 text-emerald-800 ring-emerald-600/20",
  RIESGO_BAJO: "bg-teal-100 text-teal-800 ring-teal-600/20",
  RIESGO_MEDIO: "bg-amber-100 text-amber-800 ring-amber-600/20",
  RIESGO_ALTO: "bg-orange-100 text-orange-800 ring-orange-600/20",
  CRITICO: "bg-red-100 text-red-800 ring-red-600/20",
};

/** Hex colors for charts. */
export const RISK_LEVEL_HEX: Record<RiskLevel, string> = {
  SIN_RIESGO: "#10b981",
  RIESGO_BAJO: "#14b8a6",
  RIESGO_MEDIO: "#f59e0b",
  RIESGO_ALTO: "#f97316",
  CRITICO: "#ef4444",
};

export const ALERT_TYPE_LABEL: Record<AlertType, string> = {
  ACADEMIC: "Academic",
  PSYCHOSOCIAL: "Psychosocial",
  PARTICIPATION: "Participation",
  PERMANENCE: "Permanence",
  COMBINED: "Combined",
  NONE: "No alert",
};

export const PROGRESS_STATUS_LABEL: Record<AcademicProgressStatus, string> = {
  ON_TRACK: "On track",
  SLIGHTLY_BEHIND: "Slightly behind",
  BEHIND: "Behind",
  CRITICAL_DELAY: "Critical delay",
};

export const REVIEW_STATUS_LABEL: Record<ReviewStatus, string> = {
  PENDING: "Pending",
  REVIEWED: "Reviewed",
  IN_PROGRESS: "In progress",
  RESOLVED: "Resolved",
};

export const REQUEST_STATUS_LABEL: Record<RequestStatus, string> = {
  SUBMITTED: "Submitted",
  IN_REVIEW: "In review",
  RESOLVED: "Resolved",
  REJECTED: "Rejected",
  PENDING: "Pending",
};

export const ACTIVITY_TYPE_LABEL: Record<ActivityType, string> = {
  INDIVIDUAL_TUTORING: "Individual tutoring",
  GROUP_TUTORING: "Group tutoring",
  INDIVIDUAL_MENTORING: "Individual mentoring",
  GROUP_MENTORING: "Group mentoring",
  WORKSHOP: "Workshop",
  PSYCHOSOCIAL_SUPPORT: "Psychosocial support",
  INDIVIDUAL_SESSION: "Individual session",
  OTHER: "Other",
};

export const RISK_CHANGE_LABEL: Record<RiskChangeLabel, string> = {
  STRONG_IMPROVEMENT: "Strong improvement",
  IMPROVED: "Improved",
  STABLE: "Stable",
  WORSENED: "Worsened",
  SIGNIFICANT_DETERIORATION: "Significant deterioration",
};

export const SELECTION_STAGE_LABEL: Record<SelectionStage, string> = {
  APPLICATION_RECEIVED: "Application received",
  ELIGIBILITY_REVIEW: "Eligibility review",
  ASSESSMENT: "Assessment",
  INTERVIEW: "Interview",
  FINAL_COMMITTEE: "Final committee",
  SELECTED: "Selected",
  REJECTED: "Rejected",
  WITHDRAWN: "Withdrawn",
};

export const IMPORT_ENTITY_LABEL: Record<string, string> = {
  SCHOLAR: "Scholars",
  ACADEMIC_TERM: "Academic terms",
  MONTHLY_CHECKIN: "Check-ins",
  MENTOR_REPORT: "Mentor reports",
  SUPPORT_ACTIVITY: "Support activities",
  SCHOLAR_REQUEST: "Requests",
  FINANCIAL_INPUT: "Costs",
};

export const IMPORT_SOURCE_LABEL: Record<string, string> = {
  TEMPLATE: "Template",
  LEGACY_WIDE_EXCEL: "Legacy Excel",
};

export const IMPORT_STATUS_LABEL: Record<string, string> = {
  PENDING: "Pending",
  VALIDATED: "Validated",
  COMMITTED: "Committed",
  FAILED: "Failed",
};

export const IMPORT_STATUS_TONE: Record<string, "slate" | "blue" | "green" | "red"> = {
  PENDING: "slate",
  VALIDATED: "blue",
  COMMITTED: "green",
  FAILED: "red",
};

/** Entities available in the import wizard, in a sensible order. */
export const IMPORT_ENTITIES = [
  "SCHOLAR",
  "ACADEMIC_TERM",
  "MONTHLY_CHECKIN",
  "MENTOR_REPORT",
  "SUPPORT_ACTIVITY",
  "SCHOLAR_REQUEST",
  "FINANCIAL_INPUT",
] as const;

// Data quality (DataQualityIssue). issueType/severity/status are free-text strings the
// scanner writes; unknown values fall back to the raw string / a neutral tone in the UI.
export const DATA_QUALITY_ISSUE_LABEL: Record<string, string> = {
  MISSING_COHORT: "Missing cohort",
  UNKNOWN_UNIVERSITY: "Unknown university",
  CHECKIN_WITHOUT_SCHOLAR: "Check-in without scholar",
  MENTOR_REPORT_WITHOUT_SCHOLAR: "Mentor report without scholar",
  MISSING_REPORTING_MONTH: "Missing reporting month",
  INVALID_GPA: "Invalid GPA",
  INVALID_RISK_VALUE: "Invalid risk value",
  RISK_WITHOUT_SOURCE_OR_REASON: "Risk without source or reason",
  MISSING_CHECKIN_ACTIVE: "Missing check-in (active scholar)",
  MISSING_MENTOR_REPORT_ACTIVE: "Missing mentor report (active scholar)",
  DUPLICATE_SUBMISSION_ID: "Duplicate submission ID",
};

export const DATA_QUALITY_SEVERITY_LABEL: Record<string, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
};
export const DATA_QUALITY_SEVERITY_TONE: Record<string, "slate" | "amber" | "red"> = {
  low: "slate",
  medium: "amber",
  high: "red",
};

export const DATA_QUALITY_STATUS_LABEL: Record<string, string> = {
  OPEN: "Open",
  RESOLVED: "Resolved",
  IGNORED: "Ignored",
};
