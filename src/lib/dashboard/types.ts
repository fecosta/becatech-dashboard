// Typed inputs and results for the dashboard query layer (src/lib/dashboard/queries.ts).
import type { RiskBand } from "./bands";
import type { ActivityGroup, RiskTier } from "./risk-tier";
import type { RiskReasonCategory } from "../risk/reason-taxonomy";
import type { EnglishLevel } from "../academic/english-level";
import type { SocioeconomicTier } from "../scholars/socioeconomic-tier";
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
import type { GpaSummary } from "../academic/gpa-summary";
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
   * RiskAssessment.semester ("2026-1"). Chooses which semester a semester-scoped view (e.g. the
   * M1→M6 participation/risk trend) resolves against; defaults to the latest semester with data.
   * See docs/adr/008-risk-period-identity.md.
   */
  semester?: string;
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
  /** Active scholars by socioeconomic level (raw level string; "Not reported" for blank). */
  socioeconomicBreakdown: { level: string; count: number }[];
  /** Active Colombia scholars by city (currentMunicipality); top cities + an "Other cities" bucket. */
  cityBreakdown: { city: string; count: number }[];
  /** Active scholars by current English level (A1–C2), all six levels; null when none are recorded. */
  englishLevelDistribution: { level: string; count: number }[] | null;
  /** Per-university retention among in-scope scholars (active vs withdrawn), active-count desc. */
  universityRetention: {
    name: string;
    retentionPct: number;
    dropOutPct: number;
    activeCount: number;
    dropOutCount: number;
  }[];
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
  /** Country-split GPA (Colombia /5, Peru /20) plus a scale-agnostic index — never a blended mean. */
  gpaSummary: GpaSummary;
  /** share of active scholars actively participating (> 3 support activities in scope) */
  participationRate: number;
  scholarsNeedingAttention: number;
  riskDistribution: RiskDistribution;
  /** Active, ≠Cohorte-2024 scholars in scope — the denominator for risk-distribution percentages
   *  (the sheet's `BECARIO(A) ACTIVO` + `<>Cohorte 2024`). Levels sum to ≤ this; the rest is
   *  unclassified this month. */
  assessedScholars: number;
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
  /** False when a risk dimension had no data (see RiskAssessment.assessmentComplete) — the global
   *  level is then based only on the dimensions that were assessed, and should read as partial. */
  assessmentComplete: boolean;
  /** Risk dimensions with no data this period (e.g. ["participation"]) — for an "Insufficient data" note. */
  missingInputs: string[];
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
  /** Active, ≠Cohorte-2024 scholars in scope — the denominator for the distribution percentages
   *  (the sheet's official denominator). Levels sum to ≤ this; the remainder is unclassified. */
  assessedScholarCount: number;
  /** High + Critical scholars (globalRiskValue ≥ 3) — the dark-callout number. */
  criticalHighCount: number;
  /** Scholars whose current risk improved (riskChange < 0) vs. worsened (> 0), month over month. */
  improved: number;
  worsened: number;
  /** Alert-type counts among at-risk scholars (globalRiskValue ≥ 2). */
  alertTypeCounts: Record<AlertType, number>;
  /** Scholars whose latest risk assessment is incomplete (a dimension had no data) — surfaced as
   *  "Insufficient data", kept distinct from the actual risk levels so missing data ≠ high risk. */
  insufficientDataCount: number;
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
  /** Country-split GPA (Colombia /5, Peru /20) plus a scale-agnostic index — never a blended mean. */
  gpaSummary: GpaSummary;
  /** Per-country averages, each on its own native scale (single-country groups, safe to average). */
  gpaByCountry: GpaGroupStat[];
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
  /** Scholars classified in this risk tier (active, ≠Cohorte-2024) — NOT the denominator behind
   *  participatedPct; see totalActiveScholars for that. */
  scholarCount: number;
  /** Scholars in this tier with ≥1 activity — the numerator behind participatedPct. */
  participatedCount: number;
  averageActivitiesPerScholar: number;
  /** Total active scholars in scope, shared across every tier — the denominator behind
   *  participatedPct, so a small tier's full engagement isn't hidden by its own small size. */
  totalActiveScholars: number;
  /** % of ALL active scholars (not just this tier) that are both in this tier and have ≥1
   *  activity — so tile percentages are comparable to each other and sum toward the whole active
   *  population, rather than each being relative to its own tier's size. */
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
  /** Distinct RiskAssessment.semester values, chronologically sorted (Early Support's semester pill). */
  semesters: string[];
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

/**
 * One M1..M6 point of the Early Support participation-vs-risk trend, scoped to a single semester
 * (see docs/adr/008-risk-period-identity.md). Both metrics share one per-month denominator: the
 * risk-eligible scholars who actually have a RiskAssessment row for that (semester, program month)
 * — i.e. were classified that month. A scholar who reported activity but wasn't validly classified
 * that month (blank/unrecognized GLOBAL STATUS) counts toward neither metric, keeping the two
 * series directly comparable against the same base population every month.
 *
 * `*Pct` is null exactly when its denominator is 0 (no scholar classified that month — genuinely
 * no data, e.g. the month hasn't been reported yet), never a misleading 0%. A real zero (someone
 * was classified, but nobody in that set participated) renders as `participationPct: 0`.
 */
export interface MonthlyParticipationRiskPoint {
  /** 1..6 ("MES n" canonicalized to a number) — not a calendar month. */
  programMonth: number;
  participationCount: number;
  participationDenominator: number;
  participationPct: number | null;
  mediumPlusRiskCount: number;
  riskDenominator: number;
  mediumPlusRiskPct: number | null;
}

export interface MonthlyParticipationRiskTrend {
  /** The semester these 6 points are scoped to (filters.semester, or the latest with data). */
  semester: string;
  /** Always 6 entries, programMonth 1..6 in order — missing months still appear, with null pcts. */
  points: MonthlyParticipationRiskPoint[];
}

/** One low-risk-% row for a risk breakdown (by city / gender / socioeconomic). */
export interface RiskBreakdownRow {
  name: string;
  /** (SIN_RIESGO + RIESGO_BAJO) / scholarCount, 0-1 — same denominator as UniversityRiskRow. */
  lowRiskPct: number;
  scholarCount: number;
}

/** Early Support risk breakdowns by dimension (each over active, ≠Cohorte-2024 scholars in scope). */
export interface RiskBreakdowns {
  byCity: RiskBreakdownRow[];
  byGender: RiskBreakdownRow[];
  bySocioeconomic: RiskBreakdownRow[];
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
  /** Distinct cohorts of in-scope scholars at this university, ascending. */
  cohorts: string[];
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

// ------------------------------------------------------------------
// AUGUST 4 home sections
// ------------------------------------------------------------------

/** §1 Our Scholars — "selected" is every scholar on record. ProgramStatus has no
 *  admitted-but-never-started state and the source sheet carries only active and
 *  withdrawn, so there is nothing finer to report. */
export interface ScholarBaseCounts {
  selectedTotal: number;
  activeTotal: number;
  cohortCount: number;
  womenActive: { total: number; colombia: number; peru: number };
  byCohortCountry: {
    cohort: string;
    country: Country;
    selected: number;
    active: number;
  }[];
}

/** §2 Drop Outs. `reasons` is null rather than an empty array: there is no
 *  dropout-reason column in any source, so "none recorded" would be misleading. */
export interface DropoutOverview {
  withdrawnTotal: number;
  withdrawnWomen: number;
  selectedTotal: number;
  withdrawnPct: number;
  reasons: null;
}

/** §3 Program Retention. `perTerm` is null by design — see getCohortRetention. */
export interface CohortRetention {
  rows: {
    cohort: string;
    country: Country;
    settled: number;
    active: number;
    retentionPct: number;
  }[];
  overall: { settled: number; active: number; retentionPct: number } | null;
  byCohortYear: { year: string; retentionPct: number }[];
  byCountry: { country: Country; retentionPct: number }[];
  perTerm: null;
  target: null;
}

/** §4 Vulnerability. Percentages are always over `classified`, with `unclassified`
 *  reported beside them. */
export interface VulnerabilityTiers {
  mappingApproved: boolean;
  rows: {
    cohort: string;
    country: Country;
    counts: Record<SocioeconomicTier, number>;
    pct: Record<SocioeconomicTier, number>;
    classified: number;
    unclassified: number;
  }[];
  overall: {
    counts: Record<SocioeconomicTier, number>;
    pct: Record<SocioeconomicTier, number>;
    classified: number;
    unclassified: number;
  } | null;
}

/** §5 Where Our Scholars Are From. One matrix per country, origin x cohort year. */
export interface OriginMatrix {
  cohortYears: string[];
  rows: { origin: string; counts: Record<string, number>; total: number }[];
  total: { counts: Record<string, number>; total: number };
  /** Kept separate from the "Other" tail — these scholars reported no origin at all. */
  notReported: number;
}
export interface OriginBreakdown {
  colombia: OriginMatrix;
  peru: OriginMatrix;
}

/** §7 Retention & Dropout by University, ranked worst-first and colour-banded. */
export interface UniversityRetentionRow {
  name: string;
  country: Country;
  activeCount: number;
  dropOutCount: number;
  retentionPct: number;
  dropOutPct: number;
  band: RiskBand;
}

/** §8.1 Academic progress by country, from Scholar.academicProgress. */
export interface AcademicProgressByCountryRow {
  country: Country | "ALL";
  onTrack: number;
  behind: number;
  critical: number;
  classified: number;
  pending: number;
  notApplicable: number;
  unknown: number;
}

/** §8.2 English level by country. `classified` is the only honest denominator. */
export interface EnglishLevelByCountryRow {
  country: Country | "ALL";
  counts: Record<EnglishLevel, number>;
  classified: number;
  pending: number;
  notApplicable: number;
  unrecognized: number;
}

/** §8.3/8.4 GPA by cohort, per country, never blended across scales. */
export interface GpaByCohort {
  colombia: { scale: number; rows: { cohort: string; average: number | null; count: number }[]; overall: number | null };
  peru: { scale: number; rows: { cohort: string; average: number | null; count: number }[]; overall: number | null };
  /** Terms a scholar was not enrolled in are stored as a literal 0 in the source. */
  excludedZeroGpaCount: number;
}

// ------------------------------------------------------------------
// AUGUST 4 early-support sections
// ------------------------------------------------------------------

/** One axis of §2.2. The two axes overlap, so each carries its own denominator. */
export interface RiskReasonAxis {
  /** Scholars flagged with at least one reason on THIS axis. Percentages are over it. */
  scholarsWithAnyReason: number;
  rows: { category: RiskReasonCategory; label: string; scholarCount: number; pct: number }[];
}

export interface RiskReasonBreakdown {
  period: string;
  atRiskScholarCount: number;
  academic: RiskReasonAxis;
  psychosocial: RiskReasonAxis;
  /** Scholars whose only reasons are options the taxonomy has not classified. */
  unclassifiedScholarCount: number;
  /** The unclassified options themselves, so a drift shows up as text, not a silent gap. */
  unmappedAtoms: string[];
  /** Scholars flagged on both axes — why the two tables do not sum to the at-risk total. */
  bothAxesCount: number;
}

/** §2.3 — participation by activity group and risk tier. */
export interface ParticipationByActivityAndRisk {
  period: string;
  groups: {
    activity: ActivityGroup;
    rows: {
      tier: RiskTier;
      scholarCount: number;
      participatedCount: number;
      /** null when the tier has no scholars — never a misleading 0%. */
      pct: number | null;
    }[];
  }[];
}

/** §2.5 — risk tier by gender. */
export interface RiskByGenderRow {
  gender: "female" | "male" | "other";
  scholarCount: number;
  tiers: Record<RiskTier, number>;
  tierPct: Record<RiskTier, number>;
}

/** §1 of the scholar view — who to call first. Carries contact details, so every read
 *  must stay inside the caller's scholar access scope. */
export interface ContactPriorityRow {
  scholarId: string;
  fullName: string;
  email: string | null;
  mobilePhone: string | null;
  university: string;
  cohort: string;
  country: Country;
  riskLevel: RiskLevel;
  riskValue: number;
}
