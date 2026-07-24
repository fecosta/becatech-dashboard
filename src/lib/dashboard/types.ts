// Typed inputs and results for the dashboard query layer (src/lib/dashboard/queries.ts).
import type {
  AcademicProgressStatus,
  ActivityType,
  AlertType,
  Country,
  OperatorTrack,
  ProgramStatus,
  ReviewStatus,
  RiskChangeLabel,
  RiskLevel,
  SelectionStage,
  UniversityType,
} from "../../generated/prisma/enums";
import type { ProgramStage } from "../academic/program-stage";
import type { NormalizedGender } from "./gender";

/**
 * Filters shared across dashboard views. Scholar-level fields filter scholars directly;
 * `riskLevel` filters by each scholar's CURRENT risk; `period` chooses which month counts
 * as "current" (defaults to the latest month with data).
 */
export interface DashboardFilters {
  country?: Country;
  cohort?: string;
  university?: string;
  gender?: string;
  department?: string; // matches Scholar.currentDepartment
  programStatus?: ProgramStatus;
  riskLevel?: RiskLevel;
  period?: string;
  /**
   * Program stage (Early Support vs. Career Readiness). Injected by the stage pages,
   * not parsed from the URL; applied as a `Scholar.currentSemester` range. Scholars
   * with a null currentSemester match neither stage. See lib/academic/program-stage.ts.
   */
  programStage?: ProgramStage;
}

export type RiskDistribution = Record<RiskLevel, number>;
export type ProgressDistribution = Record<AcademicProgressStatus, number>;

/** New program-narrative aggregates for Home, composed alongside ExecutiveOverview. */
export interface HomeOverview {
  scholarsByCountry: { colombia: number; peru: number };
  /** Share of women among active scholars with a recognized gender; null if none classifiable. */
  womenPercentage: number | null;
  /** Raw count backing womenPercentage's numerator. */
  womenCount: number;
  /** The active cohort filter if set, otherwise the latest cohort present. */
  cohortSpotlight: { cohort: string | null; count: number };
  /** Distinct non-empty universities among active in-scope scholars (approximation). */
  activeUniversityCount: number;
  /** Active scholars by normalized gender. */
  genderBreakdown: Record<NormalizedGender, number>;
  /** Active scholars by department of residence; a "Not reported" bucket covers null/blank. */
  departmentBreakdown: { department: string; count: number }[];
  /** Active scholars by program year (see lib/academic/program-year.ts). */
  scholarsByYear: { year1: number; year2: number; year3: number; unknown: number };
  /**
   * Retention rate per program year: (not WITHDRAWN) / total who started that year, among
   * in-scope scholars — actual rate only, no goal marker (no confirmed target thresholds).
   */
  retentionByYear: { year: 1 | 2 | 3; rate: number }[];
  /** Distinct delivery-partner operators serving active in-scope scholars. */
  deliveryPartnerCount: number;
}

export interface ExecutiveOverview {
  currentPeriod: string;
  totalScholars: number;
  activeScholars: number;
  withdrawnScholars: number;
  graduatedScholars: number;
  pausedScholars: number;
  /** retained (active + paused + graduated) / total */
  retentionRate: number;
  averageGpa: number;
  /** share of active scholars actively participating (> 3 support activities in scope) */
  participationRate: number;
  scholarsNeedingAttention: number;
  riskDistribution: RiskDistribution;
  totalDirectCostUsd: number;
  costPerActiveScholarUsd: number;
  costPerRetainedScholarUsd: number;
}

export interface RiskAlertRow {
  scholarId: string;
  fullName: string;
  country: Country;
  cohort: string;
  university: string;
  programStatus: ProgramStatus;
  currentMentor: string | null;
  period: string;
  globalRiskLevel: RiskLevel;
  globalRiskValue: number;
  academicRiskLevel: RiskLevel;
  psychosocialRiskLevel: RiskLevel;
  participationRiskLevel: RiskLevel;
  riskChange: number | null;
  riskChangeLabel: RiskChangeLabel | null;
  alertType: AlertType;
  riskReason: string | null;
  recommendedAction: string | null;
  reviewStatus: ReviewStatus;
  missingCheckin: boolean;
  missingMentorReport: boolean;
}

export interface RiskAlertsResult {
  currentPeriod: string;
  distribution: RiskDistribution;
  /** scholars at medium risk or above, or with a missing current-month report */
  attentionList: RiskAlertRow[];
}

/** Compact risk summary for a stage page (Early Support), reusing the shared scope. */
export interface RiskStageSummary {
  currentPeriod: string;
  distribution: RiskDistribution;
  /** High + Critical scholars (globalRiskValue ≥ 3) — the dark-callout number. */
  criticalHighCount: number;
  /** Scholars whose current risk improved (riskChange < 0) vs. worsened (> 0), month over month. */
  improved: number;
  worsened: number;
  /** Alert-type counts among at-risk scholars (globalRiskValue ≥ 2). */
  alertTypeCounts: Record<AlertType, number>;
}

export interface GpaGroupStat {
  key: string;
  scholarCount: number;
  averageGpa: number;
}

export interface BehindRow {
  scholarId: string;
  fullName: string;
  cohort: string;
  country: Country;
  university: string;
  latestTerm: string | null;
  progressPercentage: number | null;
  expectedProgressStatus: AcademicProgressStatus | null;
  failedSubjectsCount: number | null;
}

/** GPA-distribution buckets (see lib/academic/gpa-bucket.ts) — scholar counts, not %. */
export interface GpaDistribution {
  below3_5: number;
  from3_5To3_9: number;
  from4_0To5_0: number;
}

export interface AcademicProgressResult {
  averageGpa: number;
  gpaByCohort: GpaGroupStat[];
  gpaByCountry: GpaGroupStat[];
  gpaByUniversity: GpaGroupStat[];
  progressStatusDistribution: ProgressDistribution;
  academicRiskDistribution: RiskDistribution;
  scholarsBehind: BehindRow[];
  scholarsWithFailedSubjects: number;
  gpaDistribution: GpaDistribution;
}

export interface ActivityTypeStat {
  activityType: ActivityType;
  totalActivities: number;
}
export interface MonthActivityStat {
  period: string;
  totalActivities: number;
  /** % of in-scope active scholars with ≥1 activity in this period. */
  participationRatePct: number;
}
export interface ParticipationByRisk {
  riskLevel: RiskLevel;
  scholarCount: number;
  averageActivitiesPerScholar: number;
  /** % of scholars in this risk tier with ≥1 activity across the whole scope/period. */
  participatedPct: number;
}
export interface LowParticipationRow {
  scholarId: string;
  fullName: string;
  cohort: string;
  country: Country;
  university: string;
  totalActivities: number;
}

export interface SupportParticipationResult {
  participationRate: number;
  byActivityType: ActivityTypeStat[];
  byMonth: MonthActivityStat[];
  byRiskLevel: ParticipationByRisk[];
  lowParticipationScholars: LowParticipationRow[];
  highRiskSupport: { scholarCount: number; totalActivities: number };
}

export interface FilterOptions {
  cohorts: string[];
  universities: string[];
  periods: string[];
  /** Distinct Scholar.currentDepartment values (Home's department filter pill). */
  departments: string[];
}

export interface ScholarDirectoryRow {
  scholarId: string;
  fullName: string;
  country: Country;
  cohort: string;
  university: string;
  academicProgram: string;
  programStatus: ProgramStatus;
  currentMentor: string | null;
  currentRiskLevel: RiskLevel | null;
  latestGpa: number | null;
}

export interface StageCount {
  stage: SelectionStage;
  count: number;
}
export interface SelectionCandidateRow {
  candidateId: string;
  fullName: string;
  country: Country;
  cohort: string | null;
  university: string | null;
  currentStage: SelectionStage;
  stageStatus: string | null;
  selectionScore: number | null;
  applicationDate: Date | null;
}
export interface SelectionPipelineResult {
  total: number;
  selected: number;
  rejected: number;
  withdrawn: number;
  inProgress: number;
  conversionRate: number;
  byStage: StageCount[];
  byCountry: { country: Country; count: number }[];
  recent: SelectionCandidateRow[];
}

export interface CostGroup {
  key: string;
  totalUsd: number;
}
export interface UnitEconomicsResult {
  totalDirectCostUsd: number;
  totalScholarshipUsd: number;
  activeScholars: number;
  retainedScholars: number;
  costPerActiveScholarUsd: number;
  costPerRetainedScholarUsd: number;
  byCohort: CostGroup[];
  byCountry: CostGroup[];
  byUniversity: CostGroup[];
}

// ------------------------------------------------------------------
// Program Ecosystem (Phase B): per-university and per-operator breakdowns.
// ------------------------------------------------------------------

/** Early Support's "Scholars Status per University" — risk mix per in-scope university. */
export interface UniversityRiskRow {
  universityId: string;
  universityName: string;
  country: Country;
  scholarCount: number;
  riskDistribution: RiskDistribution;
  /** (SIN_RIESGO + RIESGO_BAJO) / scholarCount. */
  lowRiskPercentage: number;
}

/** Early Support's "Monthly Change in Risk Level" line chart — historical, not just latest. */
export interface MonthlyRiskTrendPoint {
  period: string;
  /** % of in-scope scholars with a risk row this period at RIESGO_MEDIO or above. */
  mediumPlusPct: number;
}

export interface ProgramEcosystemUniversityRow {
  universityId: string;
  name: string;
  city: string;
  country: Country;
  type: UniversityType;
  semesterStartDate: Date | null;
  semesterEndDate: Date | null;
  examWindowStart: Date | null;
  examWindowEnd: Date | null;
  scholarCount: number;
  activeScholarCount: number;
  dropOutCount: number;
  riskDistribution: RiskDistribution;
  /** Not available — no evaluation-results data source. */
  evaluationResults: null;
}

export interface ProgramEcosystemOperatorRow {
  operatorId: string;
  name: string;
  country: Country;
  track: OperatorTrack;
  scholarCount: number;
  /** Not available — OperatorSurvey was deliberately not built (no data source yet). */
  surveyResults: null;
}

export interface ProgramEcosystemResult {
  /** Full fixed partner roster, not scope-dependent — counts default to 0 when out of scope. */
  universities: ProgramEcosystemUniversityRow[];
  operators: ProgramEcosystemOperatorRow[];
}
