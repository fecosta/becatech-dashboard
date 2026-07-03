// Human-readable (Spanish) labels and colors for enum values, used by the UI.
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
  PERU: "Perú",
};

export const PROGRAM_STATUS_LABEL: Record<ProgramStatus, string> = {
  ACTIVE: "Activo",
  WITHDRAWN: "Retirado",
  GRADUATED: "Graduado",
  PAUSED: "En pausa",
};

export const RISK_LEVEL_LABEL: Record<RiskLevel, string> = {
  SIN_RIESGO: "Sin riesgo",
  RIESGO_BAJO: "Riesgo bajo",
  RIESGO_MEDIO: "Riesgo medio",
  RIESGO_ALTO: "Riesgo alto",
  CRITICO: "Crítico",
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
  ACADEMIC: "Académica",
  PSYCHOSOCIAL: "Psicosocial",
  PARTICIPATION: "Participación",
  PERMANENCE: "Permanencia",
  COMBINED: "Combinada",
  NONE: "Sin alerta",
};

export const PROGRESS_STATUS_LABEL: Record<AcademicProgressStatus, string> = {
  ON_TRACK: "Al día",
  SLIGHTLY_BEHIND: "Ligeramente atrasado",
  BEHIND: "Atrasado",
  CRITICAL_DELAY: "Atraso crítico",
};

export const REVIEW_STATUS_LABEL: Record<ReviewStatus, string> = {
  PENDING: "Pendiente",
  REVIEWED: "Revisado",
  IN_PROGRESS: "En progreso",
  RESOLVED: "Resuelto",
};

export const REQUEST_STATUS_LABEL: Record<RequestStatus, string> = {
  SUBMITTED: "Enviada",
  IN_REVIEW: "En revisión",
  RESOLVED: "Resuelta",
  REJECTED: "Rechazada",
  PENDING: "Pendiente",
};

export const ACTIVITY_TYPE_LABEL: Record<ActivityType, string> = {
  INDIVIDUAL_TUTORING: "Tutoría individual",
  GROUP_TUTORING: "Tutoría grupal",
  INDIVIDUAL_MENTORING: "Mentoría individual",
  GROUP_MENTORING: "Mentoría grupal",
  WORKSHOP: "Taller",
  PSYCHOSOCIAL_SUPPORT: "Apoyo psicosocial",
  INDIVIDUAL_SESSION: "Sesión individual",
  OTHER: "Otro",
};

export const RISK_CHANGE_LABEL: Record<RiskChangeLabel, string> = {
  STRONG_IMPROVEMENT: "Mejora fuerte",
  IMPROVED: "Mejoró",
  STABLE: "Estable",
  WORSENED: "Empeoró",
  SIGNIFICANT_DETERIORATION: "Deterioro significativo",
};

export const SELECTION_STAGE_LABEL: Record<SelectionStage, string> = {
  APPLICATION_RECEIVED: "Postulación recibida",
  ELIGIBILITY_REVIEW: "Revisión de elegibilidad",
  ASSESSMENT: "Evaluación",
  INTERVIEW: "Entrevista",
  FINAL_COMMITTEE: "Comité final",
  SELECTED: "Seleccionado",
  REJECTED: "Rechazado",
  WITHDRAWN: "Retirado",
};
