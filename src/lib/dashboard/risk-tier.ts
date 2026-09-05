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

/** All five MentorReport activity-count columns, the canonical "did they do anything this month"
 *  signal — the union of every ACTIVITY_GROUP_COLUMNS entry. */
export const ALL_ACTIVITY_COLUMNS = [
  "individualTutoring",
  "groupTutoring",
  "individualMentoring",
  "groupMentoring",
  "workshops",
] as const;

type ActivityCounts = Record<(typeof ALL_ACTIVITY_COLUMNS)[number], number>;

/** Total logged activity count across all five columns for one MentorReport row. */
export function sumActivityCounts(report: ActivityCounts): number {
  return ALL_ACTIVITY_COLUMNS.reduce((n, col) => n + (report[col] ?? 0), 0);
}

/** Whether a MentorReport row shows at least one logged activity of any kind. These columns are
 *  Int @default(0), so a blank cell and a real zero are indistinguishable at this grain (same
 *  caveat as getParticipationByActivityAndRisk) — this is the single, shared definition every
 *  participation calculation in the dashboard reuses, so it never diverges from itself. */
export function hasParticipated(report: ActivityCounts): boolean {
  return sumActivityCounts(report) > 0;
}
