// Typed inputs and results for the dashboard query layer (src/lib/dashboard/queries.ts).
import type {
  AcademicProgressStatus,
  ActivityType,
  AlertType,
  Country,
  ProgramStatus,
  ReviewStatus,
  RiskChangeLabel,
  RiskLevel,
  SelectionStage,
} from "../../generated/prisma/enums";

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
}

export type RiskDistribution = Record<RiskLevel, number>;
export type ProgressDistribution = Record<AcademicProgressStatus, number>;

/** New program-narrative aggregates for Home, composed alongside ExecutiveOverview. */
export interface HomeOverview {
  scholarsByCountry: { colombia: number; peru: number };
  /** Share of women among active scholars with a recognized gender; null if none classifiable. */
  womenPercentage: number | null;
  /** The active cohort filter if set, otherwise the latest cohort present. */
  cohortSpotlight: { cohort: string | null; count: number };
  /** Distinct non-empty universities among active in-scope scholars (approximation). */
  activeUniversityCount: number;
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

export interface AcademicProgressResult {
  averageGpa: number;
  gpaByCohort: GpaGroupStat[];
  gpaByCountry: GpaGroupStat[];
  gpaByUniversity: GpaGroupStat[];
  progressStatusDistribution: ProgressDistribution;
  academicRiskDistribution: RiskDistribution;
  scholarsBehind: BehindRow[];
  scholarsWithFailedSubjects: number;
}

export interface ActivityTypeStat {
  activityType: ActivityType;
  totalActivities: number;
}
export interface MonthActivityStat {
  period: string;
  totalActivities: number;
}
export interface ParticipationByRisk {
  riskLevel: RiskLevel;
  scholarCount: number;
  averageActivitiesPerScholar: number;
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
