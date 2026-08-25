// Three-tier grouping of the five-level risk scale, used wherever AUGUST 4 shows
// Low / Medium / High-Critical rather than the full 0–4 breakdown.
import type { RiskLevel } from "../../generated/prisma/enums";

export type RiskTier = "LOW" | "MEDIUM" | "HIGH_CRITICAL";

export const RISK_TIER_ORDER: readonly RiskTier[] = ["LOW", "MEDIUM", "HIGH_CRITICAL"];

export const RISK_TIER_LABEL: Record<RiskTier, string> = {
  LOW: "Low",
  MEDIUM: "Medium",
  HIGH_CRITICAL: "High / Critical",
};

export function riskTier(level: RiskLevel): RiskTier {
  if (level === "RIESGO_MEDIO") return "MEDIUM";
  if (level === "RIESGO_ALTO" || level === "CRITICO") return "HIGH_CRITICAL";
  return "LOW";
}

export type ActivityGroup = "TUTORING" | "MENTORING" | "WORKSHOPS";

export const ACTIVITY_GROUP_ORDER: readonly ActivityGroup[] = [
  "TUTORING",
  "MENTORING",
  "WORKSHOPS",
];

export const ACTIVITY_GROUP_LABEL: Record<ActivityGroup, string> = {
  TUTORING: "Tutoring",
  MENTORING: "Mentoring",
  WORKSHOPS: "Workshops",
};

/** Which MentorReport count columns roll up into each activity group. Individual and
 *  group sessions of the same kind are one activity from the scholar's point of view. */
export const ACTIVITY_GROUP_COLUMNS: Record<
  ActivityGroup,
  readonly ("individualTutoring" | "groupTutoring" | "individualMentoring" | "groupMentoring" | "workshops")[]
> = {
  TUTORING: ["individualTutoring", "groupTutoring"],
  MENTORING: ["individualMentoring", "groupMentoring"],
  WORKSHOPS: ["workshops"],
};
