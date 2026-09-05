// Dashboard query layer — reusable, typed server-side reads for every dashboard view.
// Aggregation is done in JS over Prisma results: the dataset is small (~100 scholars) and
// this keeps the logic readable and testable. Optimize with SQL only if data volume grows.
import { bucketGpa, GPA_SCALE_MAX } from "../academic/gpa-bucket";
import { parseScholarProgress } from "../academic/academic-progress-label";
import { ENGLISH_LEVELS, type EnglishLevel, parseEnglishLevel } from "../academic/english-level";
import { parseSocioeconomicTier, type SocioeconomicTier, TIER_MAPPING_APPROVED } from "../scholars/socioeconomic-tier";
import { dropoutBand } from "./bands";
import {
  ACTIVITY_GROUP_COLUMNS,
  ACTIVITY_GROUP_ORDER,
  hasParticipated,
  RISK_TIER_ORDER,
  type RiskTier,
  riskTier,
  sumActivityCounts,
} from "./risk-tier";
import { compareSemesters, latestSemester } from "./semester";
import {
  CATEGORIES_BY_AXIS,
  categorizeAlertAtom,
  normalizeAlertAtom,
  RISK_REASON_LABEL,
  type RiskAxis,
  type RiskReasonCategory,
  splitAlertAtoms,
} from "../risk/reason-taxonomy";
import { cohortYear, normalizeOrigin, originKey } from "./origin";
import { summarizeGpa } from "../academic/gpa-summary";
import { type CurrentUser, scholarAccessWhere } from "../auth/authorization";
import { deriveExpectedProgressStatus } from "../academic/progress";
import { YEARS_1_2_MAX_SEMESTER } from "../academic/program-stage";
import { programYearFromSemester } from "../academic/program-year";
import { prisma } from "../db";
import type { AcademicTerm, Prisma, RiskAssessment } from "../../generated/prisma/client";
import {
  AcademicProgressStatus,
  ActivityType,
  AlertType,
  Country,
  ProgramStatus,
  RiskLevel,
  SelectionStage,
} from "../../generated/prisma/enums";
import type {
  AcademicProgressByCountryRow,
  AcademicProgressResult,
  CohortRetention,
  DropoutOverview,
  EnglishLevelByCountryRow,
  GpaByCohort,
  OriginBreakdown,
  OriginMatrix,
  ContactPriorityRow,
  ParticipationByActivityAndRisk,
  RiskByGenderRow,
  RiskReasonAxis,
  RiskReasonBreakdown,
  ScholarBaseCounts,
  UniversityRetentionRow,
  VulnerabilityTiers,
  CostGroup,
  DashboardFilters,
  ExecutiveOverview,
  FilterOptions,
  GpaGroupStat,
  HomeOverview,
  MonthlyParticipationRiskPoint,
  MonthlyParticipationRiskTrend,
  MonthlyRiskTrendPoint,
  ProgramEcosystemResult,
  ProgressDistribution,
  RiskAlertRow,
  RiskAlertsResult,
  RiskBreakdownRow,
  RiskBreakdowns,
  RiskDistribution,
  RiskStageSummary,
  ScholarDirectoryRow,
  SelectionPipelineResult,
  StageCount,
  SupportParticipationResult,
  UnitEconomicsResult,
  UniversityRiskRow,
} from "./types";
import { isCohort2024, latestCohort } from "./cohort";
import { comparePeriods, latestProgramMonth, programMonthNumber } from "./program-month";
import { describeFreshness, type Freshness, syncAutomationPaused } from "./freshness";
import { normalizeGender, type NormalizedGender } from "./gender";

// ------------------------------------------------------------------
// Currency: normalize to USD for comparable "basic" unit economics.
// Demo FX rates — replace with real rates for production reporting.
// ------------------------------------------------------------------
export const USD_PER_UNIT: Record<string, number> = {
  COP: 1 / 4000,
  PEN: 1 / 3.75,
  USD: 1,
};
export function toUsd(amount: Prisma.Decimal | number | string, currency: string): number {
  return Number(amount) * (USD_PER_UNIT[currency] ?? 1);
}

// ------------------------------------------------------------------
// Small helpers
// ------------------------------------------------------------------
const round2 = (n: number) => Math.round(n * 100) / 100;
function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return round2(values.reduce((a, b) => a + b, 0) / values.length);
}
function pushTo<K>(map: Map<K, number[]>, key: K, value: number) {
  const arr = map.get(key);
  if (arr) arr.push(value);
  else map.set(key, [value]);
}
function emptyRiskDistribution(): RiskDistribution {
  return { SIN_RIESGO: 0, RIESGO_BAJO: 0, RIESGO_MEDIO: 0, RIESGO_ALTO: 0, CRITICO: 0 };
}
function emptyProgressDistribution(): ProgressDistribution {
  return { ON_TRACK: 0, SLIGHTLY_BEHIND: 0, BEHIND: 0, CRITICAL_DELAY: 0 };
}

/** Scholar where-clause including status; used by most views. */
function scholarWhere(filters: DashboardFilters): Prisma.ScholarWhereInput {
  return {
    ...geoScholarWhere(filters),
    ...(filters.programStatus ? { programStatus: filters.programStatus } : {}),
    ...programStageWhere(filters.programStage),
  };
}

/**
 * Translate a program stage into a `currentSemester` range (no schema change — this is
 * a real column). YEARS_1_2 = semesters ≤ YEARS_1_2_MAX_SEMESTER, YEARS_3_5 = above it.
 * Scholars with a null currentSemester match neither (Prisma range excludes nulls).
 */
function programStageWhere(stage: DashboardFilters["programStage"]): Prisma.ScholarWhereInput {
  if (stage === "YEARS_1_2") return { currentSemester: { lte: YEARS_1_2_MAX_SEMESTER } };
  if (stage === "YEARS_3_5") return { currentSemester: { gt: YEARS_1_2_MAX_SEMESTER } };
  return {};
}
/** Scholar where-clause excluding status/risk/period (geography + demographics only). */
function geoScholarWhere(filters: DashboardFilters): Prisma.ScholarWhereInput {
  return {
    ...(filters.country ? { country: filters.country } : {}),
    ...(filters.cohort ? { cohort: filters.cohort } : {}),
    ...(filters.university ? { university: { name: filters.university } } : {}),
    ...(filters.gender ? { gender: filters.gender } : {}),
    ...(filters.department ? { currentDepartment: filters.department } : {}),
  };
}
function financialWhere(filters: DashboardFilters): Prisma.FinancialInputWhereInput {
  return {
    ...(filters.country ? { country: filters.country } : {}),
    ...(filters.cohort ? { cohort: filters.cohort } : {}),
    ...(filters.university ? { university: filters.university } : {}),
  };
}

// The "current period" is the latest month on record, across ALL semesters — semester-agnostic by
// design today (unchanged by ADR-008). RiskAssessment.semester now exists and is populated, so a
// semester-scoped "current period" is a matter of filtering an existing column, not a schema gap —
// but doing so needs a semester dimension threaded through DashboardFilters/the URL/UI, which is
// out of scope here. See docs/adr/008-risk-period-identity.md.
//
// Program months ("MES n") order by number, not lexically; if the sheet reports calendar months
// instead ("2026-03"), those sort chronologically as strings. Prefer the latest MES, else the
// latest value.
async function getCurrentPeriod(): Promise<string> {
  const rows = await prisma.riskAssessment.findMany({ select: { period: true }, distinct: ["period"] });
  const periods = rows.map((r) => r.period);
  return latestProgramMonth(periods) ?? [...periods].sort().at(-1) ?? "MES 1";
}

/** The latest semester with any RiskAssessment data — the default for semester-scoped views (e.g.
 *  getMonthlyParticipationRiskTrend) when `filters.semester` isn't set. See ADR-008. */
async function getCurrentSemester(): Promise<string> {
  const rows = await prisma.riskAssessment.findMany({
    where: { semester: { not: null } },
    select: { semester: true },
    distinct: ["semester"],
  });
  const semesters = rows.map((r) => r.semester).filter((s): s is string => !!s);
  return latestSemester(semesters) ?? "2026-1";
}

/**
 * Whether a scholar counts toward the program's official risk/retention denominators: ACTIVE and
 * NOT in Cohorte 2024 (the sheet's `BECARIO(A) ACTIVO` + `<>Cohorte 2024`). Distribution KPIs count
 * only these; the directory/profile still show every scholar.
 */
function riskEligible(s: { programStatus: ProgramStatus; cohort: string }): boolean {
  return s.programStatus === ProgramStatus.ACTIVE && !isCohort2024(s.cohort);
}

/**
 * Data-freshness for the dashboard header: how long ago the most recent import/sync committed
 * (excluding rolled-back batches), plus whether automatic sync is paused. `now` is passed in so
 * the query stays a thin DB read over the pure formatter in ./freshness.
 */
export async function getDataFreshness(now: Date): Promise<Freshness> {
  const batch = await prisma.dataImportBatch.findFirst({
    where: { status: "COMMITTED", rolledBackAt: null },
    orderBy: { uploadedAt: "desc" },
    select: { uploadedAt: true },
  });
  return describeFreshness(batch?.uploadedAt ?? null, now, { automationPaused: syncAutomationPaused() });
}

/** Distinct values that populate the dashboard filter dropdowns. */
export async function getFilterOptions(): Promise<FilterOptions> {
  const [scholars, universities, periods, semesters] = await Promise.all([
    prisma.scholar.findMany({ select: { cohort: true, currentDepartment: true } }),
    prisma.university.findMany({ select: { name: true }, orderBy: { name: "asc" } }),
    prisma.riskAssessment.findMany({
      select: { period: true },
      distinct: ["period"],
      orderBy: { period: "asc" },
    }),
    prisma.riskAssessment.findMany({
      where: { semester: { not: null } },
      select: { semester: true },
      distinct: ["semester"],
    }),
  ]);
  return {
    cohorts: [...new Set(scholars.map((s) => s.cohort))].sort(),
    universities: universities.map((u) => u.name),
    periods: periods.map((p) => p.period),
    departments: [...new Set(scholars.map((s) => s.currentDepartment).filter((d): d is string => !!d))].sort(),
    semesters: sortSemesters(semesters.map((s) => s.semester).filter((s): s is string => !!s)),
  };
}

function sortSemesters(semesters: string[]): string[] {
  return [...semesters].sort(compareSemesters);
}

// Each scholar's current risk = their most recent classification at or before the selected period.
// Mentor reports are spread across months, so "latest ≤ current" shows every scholar's standing
// (not just those who happened to report in the newest month). Period ordering is program-month
// aware (MES n by number; calendar months as strings).
//
// Semester-agnostic by design today (unchanged by ADR-008): if a scholar has rows in two different
// semesters at the same MES n, picking between them here is ambiguous. Fixing that needs a
// semester dimension in DashboardFilters/the URL, out of scope for the identity fix — see
// docs/adr/008-risk-period-identity.md.
async function currentRiskByScholar(
  scholarIds: string[],
  currentPeriod: string,
): Promise<Map<string, RiskAssessment>> {
  const map = new Map<string, RiskAssessment>();
  if (scholarIds.length === 0) return map;
  const rows = await prisma.riskAssessment.findMany({ where: { scholarId: { in: scholarIds } } });
  for (const row of rows) {
    if (comparePeriods(row.period, currentPeriod) > 0) continue; // later than the selected period
    const cur = map.get(row.scholarId);
    if (!cur || comparePeriods(row.period, cur.period) > 0) map.set(row.scholarId, row);
  }
  return map;
}

/** Sets of scholarIds that submitted a check-in / mentor report in `period`. */
async function reportSets(scholarIds: string[], period: string) {
  if (scholarIds.length === 0) {
    return { checkinSet: new Set<string>(), mentorSet: new Set<string>() };
  }
  const [checkins, mentors] = await Promise.all([
    prisma.monthlyCheckin.findMany({
      where: { scholarId: { in: scholarIds }, reportingMonth: period },
      select: { scholarId: true },
    }),
    prisma.mentorReport.findMany({
      where: { scholarId: { in: scholarIds }, reportingMonth: period },
      select: { scholarId: true },
    }),
  ]);
  return {
    checkinSet: new Set(checkins.map((c) => c.scholarId)),
    mentorSet: new Set(mentors.map((m) => m.scholarId)),
  };
}

/** Latest term per scholar (max term string). */
async function latestTermByScholar(scholarIds: string[]) {
  const map = new Map<string, AcademicTerm>();
  if (scholarIds.length === 0) return map;
  const terms = await prisma.academicTerm.findMany({
    where: { scholarId: { in: scholarIds } },
    orderBy: { term: "asc" },
  });
  for (const t of terms) map.set(t.scholarId, t);
  return map;
}

/**
 * Shared scope: filtered scholars (incl. riskLevel), their current risk, and report sets.
 * `access` is a server-side visibility fragment (e.g. a mentor's assigned-scholars restriction);
 * it is ANDed into the scholar query so scholar-level views can never return out-of-scope rows.
 */
async function loadScope(filters: DashboardFilters, access: Prisma.ScholarWhereInput = {}) {
  const currentPeriod = filters.period ?? (await getCurrentPeriod());
  let scholars = await prisma.scholar.findMany({
    where: { AND: [scholarWhere(filters), access] },
    include: { university: true, operator: true },
    orderBy: { scholarId: "asc" },
  });
  const riskMap = await currentRiskByScholar(
    scholars.map((s) => s.scholarId),
    currentPeriod,
  );
  if (filters.riskLevel) {
    scholars = scholars.filter(
      (s) => riskMap.get(s.scholarId)?.globalRiskLevel === filters.riskLevel,
    );
  }
  const { checkinSet, mentorSet } = await reportSets(
    scholars.map((s) => s.scholarId),
    currentPeriod,
  );
  return { currentPeriod, scholars, riskMap, checkinSet, mentorSet };
}

// ------------------------------------------------------------------
// 9.1 Executive overview
// ------------------------------------------------------------------
export async function getExecutiveOverview(
  filters: DashboardFilters = {},
): Promise<ExecutiveOverview> {
  const { currentPeriod, scholars, riskMap, checkinSet, mentorSet } = await loadScope(filters);
  const ids = scholars.map((s) => s.scholarId);

  const counts = { ACTIVE: 0, WITHDRAWN: 0, GRADUATED: 0, PAUSED: 0 };
  for (const s of scholars) counts[s.programStatus] += 1;
  const total = scholars.length;
  const retained = counts.ACTIVE + counts.PAUSED + counts.GRADUATED;

  // Persistence/retention = ACTIVE ÷ scholars with a known status, excluding Cohorte 2024 — the
  // sheet's "Persistence Rate" (its numerator is strictly BECARIO(A) ACTIVO, not +graduated/+paused).
  // Every scholar in the DB has a status, so the denominator is the in-scope ≠2024 scholars.
  const retentionEligible = scholars.filter((s) => !isCohort2024(s.cohort));
  const retentionActive = retentionEligible.filter(
    (s) => s.programStatus === ProgramStatus.ACTIVE,
  ).length;

  // GPA summary from each scholar's latest accumulated GPA, kept country-aware (Colombia 0–5 vs
  // Peru 0–20 are never blended into one raw mean — see lib/academic/gpa-summary.ts).
  const latestTerms = await latestTermByScholar(ids);
  const gpaSummary = summarizeGpa(
    scholars.map((s) => ({ gpa: latestTerms.get(s.scholarId)?.accumulatedGpa, country: s.country })),
  );

  // Risk distribution (over active, ≠Cohorte-2024 scholars — the sheet's denominator) + scholars
  // needing attention. `assessedScholars` is that denominator; percentages are level/denominator.
  const riskDistribution = emptyRiskDistribution();
  let assessedScholars = 0;
  let needingAttention = 0;
  for (const s of scholars) {
    const cur = riskMap.get(s.scholarId);
    if (riskEligible(s)) {
      assessedScholars += 1;
      if (cur) riskDistribution[cur.globalRiskLevel] += 1;
    }
    const active = s.programStatus === ProgramStatus.ACTIVE;
    const highRisk = (cur?.globalRiskValue ?? 0) >= 2;
    const missing = active && (!checkinSet.has(s.scholarId) || !mentorSet.has(s.scholarId));
    if (highRisk || missing) needingAttention += 1;
  }

  // Participation: active scholars with meaningful engagement (> 3 logged activities), in scope.
  // Sourced from MENTOR REPORTS activity counts (same signal the risk engine uses) — the deprecated
  // SUPPORT ACTIVITY LOG is no longer synced and must not be read here.
  const activeIds = scholars
    .filter((s) => s.programStatus === ProgramStatus.ACTIVE)
    .map((s) => s.scholarId);
  const mentorRows = activeIds.length
    ? await prisma.mentorReport.findMany({
        where: { scholarId: { in: activeIds } },
        select: {
          scholarId: true,
          individualTutoring: true,
          groupTutoring: true,
          individualMentoring: true,
          groupMentoring: true,
          workshops: true,
        },
      })
    : [];
  const activityTotals = new Map<string, number>();
  for (const r of mentorRows) {
    const n =
      r.individualTutoring +
      r.groupTutoring +
      r.individualMentoring +
      r.groupMentoring +
      r.workshops;
    activityTotals.set(r.scholarId, (activityTotals.get(r.scholarId) ?? 0) + n);
  }
  const participatingActive = activeIds.filter((id) => (activityTotals.get(id) ?? 0) > 3).length;
  const participationRate = activeIds.length ? participatingActive / activeIds.length : 0;

  // Basic unit economics (USD), respecting geo filters.
  const financials = await prisma.financialInput.findMany({ where: financialWhere(filters) });
  const totalDirectCostUsd = round2(
    financials.filter((f) => f.isDirectCost).reduce((sum, f) => sum + toUsd(f.costAmount, f.currency), 0),
  );

  return {
    currentPeriod,
    totalScholars: total,
    activeScholars: counts.ACTIVE,
    withdrawnScholars: counts.WITHDRAWN,
    graduatedScholars: counts.GRADUATED,
    pausedScholars: counts.PAUSED,
    retentionRate: retentionEligible.length ? round2(retentionActive / retentionEligible.length) : 0,
    gpaSummary,
    participationRate: round2(participationRate),
    scholarsNeedingAttention: needingAttention,
    riskDistribution,
    assessedScholars,
    totalDirectCostUsd,
    costPerActiveScholarUsd: counts.ACTIVE ? round2(totalDirectCostUsd / counts.ACTIVE) : 0,
    costPerRetainedScholarUsd: retained ? round2(totalDirectCostUsd / retained) : 0,
  };
}

// ------------------------------------------------------------------
// 9.1b Home narrative extras (program-composition aggregates)
// Composed alongside getExecutiveOverview (which supplies KPIs, risk, status, attention);
// this covers only the new country/gender/cohort/university fields.
// ------------------------------------------------------------------
export async function getHomeOverview(filters: DashboardFilters = {}): Promise<HomeOverview> {
  const { scholars } = await loadScope(filters);
  const active = scholars.filter((s) => s.programStatus === ProgramStatus.ACTIVE);

  const scholarsByCountry = {
    colombia: active.filter((s) => s.country === Country.COLOMBIA).length,
    peru: active.filter((s) => s.country === Country.PERU).length,
  };

  // "Active Women %" per the sheet: active women ÷ ALL women (any status) in cohorts 2025/26
  // (Cohorte 2024 excluded). This is a women-RETENTION metric ("% of women still active"), not a
  // gender-composition %. (Composition is still available via `genderBreakdown` below.)
  const women = scholars.filter(
    (s) => !isCohort2024(s.cohort) && normalizeGender(s.gender) === "female",
  );
  const activeWomen = women.filter((s) => s.programStatus === ProgramStatus.ACTIVE).length;
  const womenPercentage = women.length ? round2(activeWomen / women.length) : null;

  // "Selected or latest cohort": honor an active cohort filter, else the latest present.
  const cohort = filters.cohort ?? latestCohort(active.map((s) => s.cohort));
  const cohortCount = cohort ? active.filter((s) => s.cohort === cohort).length : 0;

  const activeUniversityCount = new Set(active.map((s) => s.university.name)).size;

  // Gender breakdown among active scholars (all 4 buckets, including "unknown").
  const genderBreakdown: Record<NormalizedGender, number> = {
    female: 0,
    male: 0,
    other: 0,
    unknown: 0,
  };
  for (const s of active) genderBreakdown[normalizeGender(s.gender)] += 1;

  // Department-of-residence breakdown among active scholars; null/blank -> "Not reported".
  const deptCounts = new Map<string, number>();
  for (const s of active) {
    const dept = s.currentDepartment?.trim() || "Not reported";
    deptCounts.set(dept, (deptCounts.get(dept) ?? 0) + 1);
  }
  const departmentBreakdown = [...deptCounts.entries()]
    .map(([department, count]) => ({ department, count }))
    .sort((a, b) => b.count - a.count);

  // Scholars by program year among active scholars (see lib/academic/program-year.ts).
  const scholarsByYear = { year1: 0, year2: 0, year3: 0, unknown: 0 };
  for (const s of active) {
    const year = programYearFromSemester(s.currentSemester);
    if (year === "YEAR_1") scholarsByYear.year1 += 1;
    else if (year === "YEAR_2") scholarsByYear.year2 += 1;
    else if (year === "YEAR_3") scholarsByYear.year3 += 1;
    else scholarsByYear.unknown += 1;
  }

  // Retention rate per program year: (not WITHDRAWN) / total who started that year, among
  // in-scope scholars of every status (so the denominator includes withdrawals).
  const retentionByYear: HomeOverview["retentionByYear"] = ([1, 2, 3] as const).map((year) => {
    const yearKey = year === 1 ? "YEAR_1" : year === 2 ? "YEAR_2" : "YEAR_3";
    const cohortScholars = scholars.filter(
      (s) => programYearFromSemester(s.currentSemester) === yearKey,
    );
    const retained = cohortScholars.filter(
      (s) => s.programStatus !== ProgramStatus.WITHDRAWN,
    ).length;
    return { year, rate: cohortScholars.length ? round2(retained / cohortScholars.length) : 0 };
  });

  const deliveryPartnerCount = new Set(
    active.map((s) => s.operator?.name).filter((n): n is string => !!n),
  ).size;

  // Socioeconomic condition among active scholars (raw level; blank -> "Not reported").
  const SES_ORDER = ["Baja", "Media", "Alta"];
  const sesCounts = new Map<string, number>();
  for (const s of active) {
    const level = s.socioeconomicLevel?.trim() || "Not reported";
    sesCounts.set(level, (sesCounts.get(level) ?? 0) + 1);
  }
  const socioeconomicBreakdown = [...sesCounts.entries()]
    .map(([level, count]) => ({ level, count }))
    .sort((a, b) => {
      const ia = SES_ORDER.indexOf(a.level);
      const ib = SES_ORDER.indexOf(b.level);
      if (ia !== -1 || ib !== -1) return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
      return b.count - a.count;
    });

  // Active Colombia scholars by city (municipality); top cities + an "Other cities" bucket.
  const cityCounts = new Map<string, number>();
  for (const s of active) {
    if (s.country !== Country.COLOMBIA) continue;
    const city = s.currentMunicipality?.trim();
    if (city) cityCounts.set(city, (cityCounts.get(city) ?? 0) + 1);
  }
  const sortedCities = [...cityCounts.entries()].sort((a, b) => b[1] - a[1]);
  const TOP_CITIES = 4;
  const cityBreakdown = sortedCities.slice(0, TOP_CITIES).map(([city, count]) => ({ city, count }));
  const otherCities = sortedCities.slice(TOP_CITIES).reduce((n, [, c]) => n + c, 0);
  if (otherCities > 0) cityBreakdown.push({ city: "Other cities", count: otherCities });

  // English level distribution among active scholars (canonical A1–C2); null when none recorded.
  const ENGLISH_LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"] as const;
  const engCounts = new Map<string, number>();
  for (const s of active) {
    const raw = s.currentEnglishLevel?.trim().toUpperCase();
    const level = ENGLISH_LEVELS.find((l) => raw?.startsWith(l));
    if (level) engCounts.set(level, (engCounts.get(level) ?? 0) + 1);
  }
  const englishTotal = [...engCounts.values()].reduce((n, c) => n + c, 0);
  const englishLevelDistribution = englishTotal
    ? ENGLISH_LEVELS.map((level) => ({ level, count: engCounts.get(level) ?? 0 }))
    : null;

  // Per-university retention among in-scope scholars (active vs withdrawn), pct summing to 100.
  const uniAgg = new Map<string, { active: number; dropout: number }>();
  for (const s of scholars) {
    const name = s.university.name;
    if (!name) continue;
    const row = uniAgg.get(name) ?? { active: 0, dropout: 0 };
    if (s.programStatus === ProgramStatus.ACTIVE) row.active += 1;
    else if (s.programStatus === ProgramStatus.WITHDRAWN) row.dropout += 1;
    uniAgg.set(name, row);
  }
  const universityRetention = [...uniAgg.entries()]
    .map(([name, r]) => {
      const denom = r.active + r.dropout;
      const retentionPct = denom ? Math.round((r.active / denom) * 100) : 0;
      return {
        name,
        activeCount: r.active,
        dropOutCount: r.dropout,
        retentionPct,
        dropOutPct: denom ? 100 - retentionPct : 0,
      };
    })
    .filter((u) => u.activeCount + u.dropOutCount > 0)
    .sort((a, b) => b.activeCount - a.activeCount);

  return {
    scholarsByCountry,
    womenPercentage,
    womenCount: activeWomen,
    cohortSpotlight: { cohort, count: cohortCount },
    activeUniversityCount,
    genderBreakdown,
    departmentBreakdown,
    scholarsByYear,
    retentionByYear,
    deliveryPartnerCount,
    socioeconomicBreakdown,
    cityBreakdown,
    englishLevelDistribution,
    universityRetention,
  };
}

// ------------------------------------------------------------------
// 9.2 Risk & alerts
// ------------------------------------------------------------------
export async function getRiskAlerts(
  filters: DashboardFilters = {},
  user: CurrentUser | null = null,
): Promise<RiskAlertsResult> {
  const { currentPeriod, scholars, riskMap, checkinSet, mentorSet } = await loadScope(
    filters,
    scholarAccessWhere(user),
  );

  const distribution = emptyRiskDistribution();
  const attentionList: RiskAlertRow[] = [];

  for (const s of scholars) {
    const cur = riskMap.get(s.scholarId);
    if (cur && riskEligible(s)) distribution[cur.globalRiskLevel] += 1;

    const active = s.programStatus === ProgramStatus.ACTIVE;
    const missingCheckin = active && !checkinSet.has(s.scholarId);
    const missingMentorReport = active && !mentorSet.has(s.scholarId);
    const highRisk = (cur?.globalRiskValue ?? 0) >= 2;
    if (!highRisk && !missingCheckin && !missingMentorReport) continue;
    if (!cur) continue; // need a risk row to describe the alert

    attentionList.push({
      scholarId: s.scholarId,
      fullName: s.fullName,
      country: s.country,
      cohort: s.cohort,
      university: s.university.name,
      programStatus: s.programStatus,
      currentMentor: s.currentMentor,
      period: cur.period,
      globalRiskLevel: cur.globalRiskLevel,
      globalRiskValue: cur.globalRiskValue,
      academicRiskLevel: cur.academicRiskLevel,
      psychosocialRiskLevel: cur.psychosocialRiskLevel,
      participationRiskLevel: cur.participationRiskLevel,
      riskChange: cur.riskChange,
      riskChangeLabel: cur.riskChangeLabel,
      alertType: cur.alertType,
      riskReason: cur.riskReason,
      recommendedAction: cur.recommendedAction,
      reviewStatus: cur.reviewStatus,
      missingCheckin,
      missingMentorReport,
      assessmentComplete: cur.assessmentComplete,
      missingInputs: cur.missingInputs,
    });
  }

  attentionList.sort(
    (a, b) => b.globalRiskValue - a.globalRiskValue || (b.riskChange ?? 0) - (a.riskChange ?? 0),
  );
  return { currentPeriod, distribution, attentionList };
}

function emptyAlertTypeCounts(): Record<AlertType, number> {
  return {
    [AlertType.ACADEMIC]: 0,
    [AlertType.PSYCHOSOCIAL]: 0,
    [AlertType.PARTICIPATION]: 0,
    [AlertType.PERMANENCE]: 0,
    [AlertType.COMBINED]: 0,
    [AlertType.NONE]: 0,
  };
}

/**
 * Compact risk summary for a stage page (Early Support): the 5-level distribution, the
 * High+Critical count, month-over-month improved/worsened counts, and the alert-type
 * split among at-risk scholars. Reuses the shared scope so the programStage/geo filters
 * apply uniformly. Pure aggregation over existing data — no schema change.
 */
export async function getRiskStageSummary(
  filters: DashboardFilters = {},
): Promise<RiskStageSummary> {
  const { currentPeriod, scholars, riskMap } = await loadScope(filters);

  const distribution = emptyRiskDistribution();
  const alertTypeCounts = emptyAlertTypeCounts();
  let improved = 0;
  let worsened = 0;
  let insufficientDataCount = 0;
  // Denominator = active, ≠Cohorte-2024 scholars in scope (the sheet's denominator). Percentages
  // are level/assessedScholarCount; the unclassified remainder is implicit ("no report this month").
  let assessedScholarCount = 0;

  for (const s of scholars) {
    if (!riskEligible(s)) continue;
    assessedScholarCount += 1;
    const cur = riskMap.get(s.scholarId);
    if (!cur) continue;
    distribution[cur.globalRiskLevel] += 1;
    if (!cur.assessmentComplete) insufficientDataCount += 1;
    if (cur.riskChange != null) {
      if (cur.riskChange < 0) improved += 1;
      else if (cur.riskChange > 0) worsened += 1;
    }
    if (cur.globalRiskValue >= 2) alertTypeCounts[cur.alertType] += 1;
  }

  return {
    currentPeriod,
    distribution,
    assessedScholarCount,
    criticalHighCount: distribution.RIESGO_ALTO + distribution.CRITICO,
    improved,
    worsened,
    alertTypeCounts,
    insufficientDataCount,
  };
}

/** Early Support's "Scholars Status per University" — risk mix per in-scope university. */
export async function getUniversityRiskBreakdown(
  filters: DashboardFilters = {},
): Promise<UniversityRiskRow[]> {
  const { scholars, riskMap } = await loadScope(filters);

  const byUniversity = new Map<
    string,
    {
      universityId: string;
      universityName: string;
      country: Country;
      scholarCount: number;
      riskDistribution: RiskDistribution;
    }
  >();
  for (const s of scholars) {
    if (!riskEligible(s)) continue; // per-university mix over active, ≠Cohorte-2024 scholars
    let entry = byUniversity.get(s.universityId);
    if (!entry) {
      entry = {
        universityId: s.universityId,
        universityName: s.university.name,
        country: s.university.country,
        scholarCount: 0,
        riskDistribution: emptyRiskDistribution(),
      };
      byUniversity.set(s.universityId, entry);
    }
    entry.scholarCount += 1;
    const level = riskMap.get(s.scholarId)?.globalRiskLevel;
    if (level) entry.riskDistribution[level] += 1;
  }

  return [...byUniversity.values()]
    .map((entry) => ({
      ...entry,
      lowRiskPercentage: entry.scholarCount
        ? round2(
            (entry.riskDistribution.SIN_RIESGO + entry.riskDistribution.RIESGO_BAJO) /
              entry.scholarCount,
          )
        : 0,
    }))
    .sort(
      (a, b) => a.country.localeCompare(b.country) || a.universityName.localeCompare(b.universityName),
    );
}

/**
 * Early Support risk breakdowns by city / gender / socioeconomic condition. Each row's bar =
 * low-risk % (SIN_RIESGO + RIESGO_BAJO) over active, ≠Cohorte-2024 scholars in that group — the
 * same denominator convention as getUniversityRiskBreakdown (count includes unclassified).
 */
export async function getRiskBreakdowns(filters: DashboardFilters = {}): Promise<RiskBreakdowns> {
  const { scholars, riskMap } = await loadScope(filters);

  type Scoped = (typeof scholars)[number];
  const group = (keyOf: (s: Scoped) => string | null): Map<string, { count: number; low: number }> => {
    const m = new Map<string, { count: number; low: number }>();
    for (const s of scholars) {
      if (!riskEligible(s)) continue;
      const key = keyOf(s);
      if (!key) continue;
      const row = m.get(key) ?? { count: 0, low: 0 };
      row.count += 1;
      const level = riskMap.get(s.scholarId)?.globalRiskLevel;
      if (level === "SIN_RIESGO" || level === "RIESGO_BAJO") row.low += 1;
      m.set(key, row);
    }
    return m;
  };
  const toRows = (
    m: Map<string, { count: number; low: number }>,
    order?: string[],
  ): RiskBreakdownRow[] =>
    [...m.entries()]
      .map(([name, r]) => ({
        name,
        scholarCount: r.count,
        lowRiskPct: r.count ? round2(r.low / r.count) : 0,
      }))
      .sort((a, b) => {
        if (order) {
          const ia = order.indexOf(a.name);
          const ib = order.indexOf(b.name);
          if (ia !== -1 || ib !== -1) return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
        }
        return b.scholarCount - a.scholarCount;
      });

  const GENDER_LABEL: Record<string, string> = { female: "Women", male: "Men", other: "Other" };
  const byGender = toRows(
    group((s) => GENDER_LABEL[normalizeGender(s.gender)] ?? null), // unknown gender excluded
    ["Women", "Men", "Other"],
  );
  const byCity = toRows(
    group((s) => (s.country === Country.COLOMBIA ? s.currentMunicipality?.trim() || null : null)),
  ).slice(0, 8);
  const bySocioeconomic = toRows(
    group((s) => s.socioeconomicLevel?.trim() || null),
    ["Baja", "Media", "Alta"],
  );

  return { byCity, byGender, bySocioeconomic };
}

/**
 * Early Support's "Monthly Change in Risk Level" line chart — the % of in-scope scholars
 * at Medium+ risk per month, across every period on record (not just the latest one).
 *
 * Aggregates by bare `period` across ALL semesters, unchanged by ADR-008 — a "MES 3" from two
 * different semesters still merges into one point today. Deferred alongside the M1→M6 trend graph
 * (docs/prototype-comparison.md, docs/PRODUCT.md); RiskAssessment.semester now exists and is
 * populated, so scoping this by semester is unblocked at the data layer whenever that UI work
 * happens. See docs/adr/008-risk-period-identity.md.
 */
export async function getMonthlyRiskTrend(
  filters: DashboardFilters = {},
): Promise<MonthlyRiskTrendPoint[]> {
  const { scholars } = await loadScope(filters);
  // Trend over active, ≠Cohorte-2024 scholars (the risk denominator).
  const scholarIds = scholars.filter(riskEligible).map((s) => s.scholarId);
  if (scholarIds.length === 0) return [];

  const rows = await prisma.riskAssessment.findMany({
    where: { scholarId: { in: scholarIds } },
    select: { period: true, globalRiskValue: true },
  });

  const totalByPeriod = new Map<string, number>();
  const mediumPlusByPeriod = new Map<string, number>();
  for (const r of rows) {
    totalByPeriod.set(r.period, (totalByPeriod.get(r.period) ?? 0) + 1);
    if (r.globalRiskValue >= 2) {
      mediumPlusByPeriod.set(r.period, (mediumPlusByPeriod.get(r.period) ?? 0) + 1);
    }
  }

  return [...totalByPeriod.entries()]
    .map(([period, total]) => ({
      period,
      mediumPlusPct: total ? round2((mediumPlusByPeriod.get(period) ?? 0) / total) : 0,
    }))
    // Program months order by number ("MES 2" before "MES 10"); calendar months sort as strings.
    .sort((a, b) => {
      const na = programMonthNumber(a.period);
      const nb = programMonthNumber(b.period);
      if (na != null && nb != null) return na - nb;
      return a.period.localeCompare(b.period);
    });
}

const PROGRAM_MONTH_NUMBERS = [1, 2, 3, 4, 5, 6];
const PROGRAM_MONTH_LABELS = PROGRAM_MONTH_NUMBERS.map((n) => `MES ${n}`);

/**
 * Early Support's M1→M6 participation-vs-risk trend, scoped to one semester (see
 * docs/adr/008-risk-period-identity.md and MonthlyParticipationRiskPoint's doc comment for the
 * shared-denominator design). Resolves `filters.semester`, or defaults to the latest semester with
 * data — the semester is always concrete, never "all".
 *
 * `filters.period` is deliberately ignored here: this view's entire purpose is showing all six
 * program months at once, so narrowing to one would defeat it. (Early Support doesn't expose a
 * `period` pill today, so this is a documented edge case rather than a live conflict.) Every other
 * scholar-scoping filter (country/cohort/university/programStage) applies as usual via loadScope().
 */
export async function getMonthlyParticipationRiskTrend(
  filters: DashboardFilters = {},
): Promise<MonthlyParticipationRiskTrend> {
  const semester = filters.semester ?? (await getCurrentSemester());
  const { scholars } = await loadScope(filters);
  const scholarIds = scholars.filter(riskEligible).map((s) => s.scholarId);

  const emptyPoints = (): MonthlyParticipationRiskPoint[] =>
    PROGRAM_MONTH_NUMBERS.map((n) => ({
      programMonth: n,
      participationCount: 0,
      participationDenominator: 0,
      participationPct: null,
      mediumPlusRiskCount: 0,
      riskDenominator: 0,
      mediumPlusRiskPct: null,
    }));

  if (scholarIds.length === 0) return { semester, points: emptyPoints() };

  const [riskRows, reports] = await Promise.all([
    prisma.riskAssessment.findMany({
      where: { scholarId: { in: scholarIds }, semester, period: { in: PROGRAM_MONTH_LABELS } },
      select: { scholarId: true, period: true, globalRiskValue: true },
    }),
    prisma.mentorReport.findMany({
      where: { scholarId: { in: scholarIds }, semester, reportingMonth: { in: PROGRAM_MONTH_LABELS } },
      select: {
        scholarId: true,
        reportingMonth: true,
        individualTutoring: true,
        groupTutoring: true,
        individualMentoring: true,
        groupMentoring: true,
        workshops: true,
      },
    }),
  ]);

  // The per-month population for BOTH metrics: risk-eligible scholars actually classified
  // (RiskAssessment row present) for this semester+month. A scholar isn't counted at all for a
  // month they weren't validly classified in — see the type's doc comment for why.
  const classifiedByMonth = new Map<number, Set<string>>();
  const mediumPlusByMonth = new Map<number, number>();
  for (const r of riskRows) {
    const n = programMonthNumber(r.period);
    if (n == null) continue;
    const set = classifiedByMonth.get(n) ?? new Set<string>();
    set.add(r.scholarId);
    classifiedByMonth.set(n, set);
    if (r.globalRiskValue >= 2) mediumPlusByMonth.set(n, (mediumPlusByMonth.get(n) ?? 0) + 1);
  }

  const participatedByMonth = new Map<number, Set<string>>();
  for (const r of reports) {
    const n = programMonthNumber(r.reportingMonth);
    if (n == null) continue;
    if (!classifiedByMonth.get(n)?.has(r.scholarId)) continue; // only within the classified set
    if (!hasParticipated(r)) continue;
    const set = participatedByMonth.get(n) ?? new Set<string>();
    set.add(r.scholarId);
    participatedByMonth.set(n, set);
  }

  const points = PROGRAM_MONTH_NUMBERS.map((n): MonthlyParticipationRiskPoint => {
    const denom = classifiedByMonth.get(n)?.size ?? 0;
    const participationCount = participatedByMonth.get(n)?.size ?? 0;
    const mediumPlusRiskCount = mediumPlusByMonth.get(n) ?? 0;
    return {
      programMonth: n,
      participationCount,
      participationDenominator: denom,
      participationPct: denom ? round2(participationCount / denom) : null,
      mediumPlusRiskCount,
      riskDenominator: denom,
      mediumPlusRiskPct: denom ? round2(mediumPlusRiskCount / denom) : null,
    };
  });

  return { semester, points };
}

/** Scholar list for the directory/search page (current risk + latest GPA). */
export async function getScholarDirectory(
  filters: DashboardFilters = {},
  search?: string,
  user: CurrentUser | null = null,
): Promise<ScholarDirectoryRow[]> {
  const { scholars, riskMap } = await loadScope(filters, scholarAccessWhere(user));
  const q = search?.trim().toLowerCase();
  const list = q
    ? scholars.filter(
        (s) =>
          s.fullName.toLowerCase().includes(q) ||
          s.scholarId.toLowerCase().includes(q) ||
          s.university.name.toLowerCase().includes(q),
      )
    : scholars;
  const gpaMap = await latestTermByScholar(list.map((s) => s.scholarId));
  return list.map((s) => ({
    scholarId: s.scholarId,
    fullName: s.fullName,
    country: s.country,
    cohort: s.cohort,
    university: s.university.name,
    academicProgram: s.academicProgram,
    programStatus: s.programStatus,
    currentMentor: s.currentMentor,
    currentRiskLevel: riskMap.get(s.scholarId)?.globalRiskLevel ?? null,
    latestGpa: gpaMap.get(s.scholarId)?.accumulatedGpa ?? null,
  }));
}

// ------------------------------------------------------------------
// 9.3 Scholar profile
// ------------------------------------------------------------------
export async function getScholarProfile(scholarId: string, user: CurrentUser | null = null) {
  // Server-side access enforcement: a mentor may only open a scholar they are assigned to. An
  // out-of-scope id returns null (indistinguishable from "not found") so no data can leak. A null
  // user (dev script) is unrestricted; page requests always pass the real user.
  if (user?.role === "MENTOR" && !user.assignedScholarIds.includes(scholarId)) return null;
  const scholar = await prisma.scholar.findUnique({
    where: { scholarId },
    include: {
      university: true,
      operator: true,
      academicTerms: { orderBy: { term: "asc" } },
      riskAssessments: { orderBy: { period: "asc" } },
      checkins: { orderBy: { reportingMonth: "asc" } },
      mentorReports: { orderBy: { reportingMonth: "asc" } },
      supportActivities: { orderBy: { period: "asc" } },
      requests: { orderBy: { submissionDate: "desc" } },
      financialInputs: { orderBy: { costCategory: "asc" } },
    },
  });
  if (!scholar) return null;

  const gpaTrend = scholar.academicTerms.map((t) => ({
    term: t.term,
    gpa: t.gpa,
    accumulatedGpa: t.accumulatedGpa,
  }));

  return { ...scholar, gpaTrend };
}
export type ScholarProfile = NonNullable<Awaited<ReturnType<typeof getScholarProfile>>>;

// ------------------------------------------------------------------
// 9.4 Academic progress
// ------------------------------------------------------------------
export async function getAcademicProgress(
  filters: DashboardFilters = {},
  user: CurrentUser | null = null,
): Promise<AcademicProgressResult> {
  const { currentPeriod, scholars, riskMap } = await loadScope(filters, scholarAccessWhere(user));
  const ids = scholars.map((s) => s.scholarId);
  const latestTerms = await latestTermByScholar(ids);

  // "Failed subjects" comes from the MENTOR REPORTS "# at-risk courses" for the current program
  // month (the sheet's academic-progress source), not the academic-term failed-subjects column.
  // Max per scholar when a MES has more than one report.
  const mentorAtRisk = ids.length
    ? await prisma.mentorReport.findMany({
        where: { scholarId: { in: ids }, reportingMonth: currentPeriod },
        select: { scholarId: true, atRiskCoursesCount: true },
      })
    : [];
  const atRiskByScholar = new Map<string, number>();
  for (const m of mentorAtRisk) {
    atRiskByScholar.set(
      m.scholarId,
      Math.max(atRiskByScholar.get(m.scholarId) ?? 0, m.atRiskCoursesCount ?? 0),
    );
  }

  const gpaByCountry = new Map<string, number[]>();
  const progressStatusDistribution = emptyProgressDistribution();
  const academicRiskDistribution = emptyRiskDistribution();
  const scholarsBehind: AcademicProgressResult["scholarsBehind"] = [];
  // Country-aware GPA rows for the summary (Colombia 0–5 vs Peru 0–20, never blended).
  const gpaRows: { gpa: number | null | undefined; country: (typeof scholars)[number]["country"] }[] = [];
  const gpaDistribution = { below3_5: 0, from3_5To3_9: 0, from4_0To5_0: 0 };
  let scholarsWithFailedSubjects = 0;

  for (const s of scholars) {
    const term = latestTerms.get(s.scholarId);
    gpaRows.push({ gpa: term?.accumulatedGpa, country: s.country });
    if (term?.accumulatedGpa != null) {
      const g = term.accumulatedGpa;
      pushTo(gpaByCountry, s.country, g);
      const bucket = bucketGpa(g, s.country);
      if (bucket === "BELOW_3_5") gpaDistribution.below3_5 += 1;
      else if (bucket === "GPA_3_5_TO_3_9") gpaDistribution.from3_5To3_9 += 1;
      else if (bucket === "GPA_4_0_TO_5_0") gpaDistribution.from4_0To5_0 += 1;
    }

    const status =
      term?.expectedProgressStatus ??
      (term && term.progressPercentage != null
        ? deriveExpectedProgressStatus(term.progressPercentage, 100)
        : null);
    if (status) progressStatusDistribution[status] += 1;

    const cur = riskMap.get(s.scholarId);
    if (cur) academicRiskDistribution[cur.academicRiskLevel] += 1;

    if ((atRiskByScholar.get(s.scholarId) ?? 0) > 0) scholarsWithFailedSubjects += 1;

    if (status === AcademicProgressStatus.BEHIND || status === AcademicProgressStatus.CRITICAL_DELAY) {
      scholarsBehind.push({
        scholarId: s.scholarId,
        fullName: s.fullName,
        cohort: s.cohort,
        country: s.country,
        university: s.university.name,
        latestTerm: term?.term ?? null,
        progressPercentage: term?.progressPercentage ?? null,
        expectedProgressStatus: status,
        failedSubjectsCount: atRiskByScholar.get(s.scholarId) ?? null,
      });
    }
  }

  const toGroupStats = (m: Map<string, number[]>): GpaGroupStat[] =>
    [...m.entries()]
      .map(([key, gpas]) => ({ key, scholarCount: gpas.length, averageGpa: mean(gpas) }))
      .sort((a, b) => a.key.localeCompare(b.key));

  scholarsBehind.sort((a, b) => (a.progressPercentage ?? 0) - (b.progressPercentage ?? 0));

  return {
    gpaSummary: summarizeGpa(gpaRows),
    gpaByCountry: toGroupStats(gpaByCountry),
    progressStatusDistribution,
    academicRiskDistribution,
    scholarsBehind,
    scholarsWithFailedSubjects,
    gpaDistribution,
  };
}

// ------------------------------------------------------------------
// 9.5 Support participation
// ------------------------------------------------------------------
export async function getSupportParticipation(
  filters: DashboardFilters = {},
): Promise<SupportParticipationResult> {
  const { scholars, riskMap } = await loadScope(filters);
  const ids = scholars.map((s) => s.scholarId);
  const activeIds = scholars
    .filter((s) => s.programStatus === ProgramStatus.ACTIVE)
    .map((s) => s.scholarId);

  // Participation is sourced from MENTOR REPORTS activity counts (the same signal the risk engine
  // and the Home KPI use). The deprecated SUPPORT ACTIVITY LOG is no longer synced and must not be
  // read here. Each report's five count columns map onto the first five ActivityType kinds; the
  // period is the report's real reporting month (YYYY-MM).
  const reports = ids.length
    ? await prisma.mentorReport.findMany({
        where: { scholarId: { in: ids } },
        select: {
          scholarId: true,
          reportingMonth: true,
          individualTutoring: true,
          groupTutoring: true,
          individualMentoring: true,
          groupMentoring: true,
          workshops: true,
        },
      })
    : [];

  const byType = new Map<ActivityType, number>([
    [ActivityType.INDIVIDUAL_TUTORING, 0],
    [ActivityType.GROUP_TUTORING, 0],
    [ActivityType.INDIVIDUAL_MENTORING, 0],
    [ActivityType.GROUP_MENTORING, 0],
    [ActivityType.WORKSHOP, 0],
  ]);
  const byMonth = new Map<string, number>();
  const scholarsByMonth = new Map<string, Set<string>>();
  const totalByScholar = new Map<string, number>();
  for (const r of reports) {
    const perType: [ActivityType, number][] = [
      [ActivityType.INDIVIDUAL_TUTORING, r.individualTutoring],
      [ActivityType.GROUP_TUTORING, r.groupTutoring],
      [ActivityType.INDIVIDUAL_MENTORING, r.individualMentoring],
      [ActivityType.GROUP_MENTORING, r.groupMentoring],
      [ActivityType.WORKSHOP, r.workshops],
    ];
    for (const [t, c] of perType) byType.set(t, (byType.get(t) ?? 0) + c);
    // Shared with getMonthlyParticipationRiskTrend's per-month check (src/lib/dashboard/risk-tier.ts)
    // so "participated" never means something different in two places.
    const rowTotal = sumActivityCounts(r);
    totalByScholar.set(r.scholarId, (totalByScholar.get(r.scholarId) ?? 0) + rowTotal);
    if (r.reportingMonth) {
      byMonth.set(r.reportingMonth, (byMonth.get(r.reportingMonth) ?? 0) + rowTotal);
      if (rowTotal > 0) {
        let set = scholarsByMonth.get(r.reportingMonth);
        if (!set) {
          set = new Set<string>();
          scholarsByMonth.set(r.reportingMonth, set);
        }
        set.add(r.scholarId);
      }
    }
  }

  // Participation by current risk level — same denominator population (active, ≠Cohorte-2024) as
  // every other risk-based percentage in this file (riskEligible()); withdrawn/graduated/paused
  // scholars, and Cohorte 2024, were previously included here (unlike everywhere else), which
  // could inflate/dilute a tier's count with scholars no longer part of the active program.
  const perLevelTotals = emptyRiskDistribution();
  const perLevelCounts = emptyRiskDistribution();
  const perLevelParticipated = emptyRiskDistribution();
  for (const s of scholars) {
    if (!riskEligible(s)) continue;
    const level = riskMap.get(s.scholarId)?.globalRiskLevel;
    if (!level) continue;
    perLevelCounts[level] += 1;
    const total = totalByScholar.get(s.scholarId) ?? 0;
    perLevelTotals[level] += total;
    if (total > 0) perLevelParticipated[level] += 1;
  }

  // Low-participation active scholars (<= 3 total activities across the period).
  const lowParticipationScholars = scholars
    .filter((s) => s.programStatus === ProgramStatus.ACTIVE)
    .map((s) => ({ s, total: totalByScholar.get(s.scholarId) ?? 0 }))
    .filter(({ total }) => total <= 3)
    .sort((a, b) => a.total - b.total)
    .slice(0, 30)
    .map(({ s, total }) => ({
      scholarId: s.scholarId,
      fullName: s.fullName,
      cohort: s.cohort,
      country: s.country,
      university: s.university.name,
      totalActivities: total,
    }));

  // Support received by high-risk (alto+) scholars.
  let highRiskScholars = 0;
  let highRiskActivities = 0;
  for (const s of scholars) {
    if ((riskMap.get(s.scholarId)?.globalRiskValue ?? 0) >= 3) {
      highRiskScholars += 1;
      highRiskActivities += totalByScholar.get(s.scholarId) ?? 0;
    }
  }

  const participatingActive = activeIds.filter((id) => (totalByScholar.get(id) ?? 0) > 3).length;

  return {
    participationRate: activeIds.length ? round2(participatingActive / activeIds.length) : 0,
    byActivityType: [...byType.entries()]
      .map(([activityType, totalActivities]) => ({ activityType, totalActivities }))
      .sort((a, b) => b.totalActivities - a.totalActivities),
    byMonth: [...byMonth.entries()]
      .map(([period, totalActivities]) => ({
        period,
        totalActivities,
        participationRatePct: activeIds.length
          ? round2((scholarsByMonth.get(period)?.size ?? 0) / activeIds.length)
          : 0,
      }))
      .sort((a, b) => a.period.localeCompare(b.period)),
    byRiskLevel: Object.values(RiskLevel).map((riskLevel) => ({
      riskLevel,
      scholarCount: perLevelCounts[riskLevel],
      participatedCount: perLevelParticipated[riskLevel],
      totalActiveScholars: activeIds.length,
      // Denominator = ALL active scholars, shared across every tier — not just this tier's own
      // count — so a small, fully-engaged tier (e.g. Critical 4/4) doesn't wash out to the same
      // 100% as a large one; its percentage instead reflects how much of the whole active
      // population it represents once engagement is accounted for.
      participatedPct: activeIds.length ? round2(perLevelParticipated[riskLevel] / activeIds.length) : 0,
      averageActivitiesPerScholar: perLevelCounts[riskLevel]
        ? round2(perLevelTotals[riskLevel] / perLevelCounts[riskLevel])
        : 0,
    })),
    lowParticipationScholars,
    highRiskSupport: { scholarCount: highRiskScholars, totalActivities: highRiskActivities },
  };
}

// ------------------------------------------------------------------
// 9.6 Unit economics
// ------------------------------------------------------------------
export async function getUnitEconomics(
  filters: DashboardFilters = {},
): Promise<UnitEconomicsResult> {
  const financials = await prisma.financialInput.findMany({ where: financialWhere(filters) });

  const statusGroups = await prisma.scholar.groupBy({
    by: ["programStatus"],
    where: geoScholarWhere(filters),
    _count: { _all: true },
  });
  const statusCount = (status: ProgramStatus) =>
    statusGroups.find((g) => g.programStatus === status)?._count._all ?? 0;
  const activeScholars = statusCount(ProgramStatus.ACTIVE);
  const retainedScholars =
    activeScholars + statusCount(ProgramStatus.PAUSED) + statusCount(ProgramStatus.GRADUATED);

  let totalDirectCostUsd = 0;
  let totalScholarshipUsd = 0;
  const byCohort = new Map<string, number>();
  const byCountry = new Map<string, number>();
  const byUniversity = new Map<string, number>();
  for (const f of financials) {
    const usd = toUsd(f.costAmount, f.currency);
    if (f.costCategory === "Scholarship amount") totalScholarshipUsd += usd;
    if (!f.isDirectCost) continue;
    totalDirectCostUsd += usd;
    const cohortKey = f.cohort ?? "Program-level";
    const countryKey = f.country ?? "Program-level";
    const uniKey = f.university ?? "Program-level";
    byCohort.set(cohortKey, (byCohort.get(cohortKey) ?? 0) + usd);
    byCountry.set(countryKey, (byCountry.get(countryKey) ?? 0) + usd);
    byUniversity.set(uniKey, (byUniversity.get(uniKey) ?? 0) + usd);
  }

  const toCostGroups = (m: Map<string, number>): CostGroup[] =>
    [...m.entries()]
      .map(([key, totalUsd]) => ({ key, totalUsd: round2(totalUsd) }))
      .sort((a, b) => b.totalUsd - a.totalUsd);

  totalDirectCostUsd = round2(totalDirectCostUsd);
  return {
    totalDirectCostUsd,
    totalScholarshipUsd: round2(totalScholarshipUsd),
    activeScholars,
    retainedScholars,
    costPerActiveScholarUsd: activeScholars ? round2(totalDirectCostUsd / activeScholars) : 0,
    costPerRetainedScholarUsd: retainedScholars ? round2(totalDirectCostUsd / retainedScholars) : 0,
    byCohort: toCostGroups(byCohort),
    byCountry: toCostGroups(byCountry),
    byUniversity: toCostGroups(byUniversity),
  };
}

// ------------------------------------------------------------------
// Selection pipeline (brief §10 / future selection layer)
// ------------------------------------------------------------------
export async function getSelectionPipeline(): Promise<SelectionPipelineResult> {
  const [byStageGroups, byCountryGroups, total, recent] = await Promise.all([
    prisma.selectionCandidate.groupBy({ by: ["currentStage"], _count: { _all: true } }),
    prisma.selectionCandidate.groupBy({ by: ["country"], _count: { _all: true } }),
    prisma.selectionCandidate.count(),
    prisma.selectionCandidate.findMany({
      orderBy: [{ applicationDate: "desc" }, { candidateId: "asc" }],
      take: 20,
      select: {
        candidateId: true,
        fullName: true,
        country: true,
        cohort: true,
        university: true,
        currentStage: true,
        stageStatus: true,
        selectionScore: true,
        applicationDate: true,
      },
    }),
  ]);

  const stageCount = (stage: SelectionStage) =>
    byStageGroups.find((g) => g.currentStage === stage)?._count._all ?? 0;
  const selected = stageCount(SelectionStage.SELECTED);
  const rejected = stageCount(SelectionStage.REJECTED);
  const withdrawn = stageCount(SelectionStage.WITHDRAWN);

  const byStage: StageCount[] = byStageGroups
    .map((g) => ({ stage: g.currentStage, count: g._count._all }))
    .sort((a, b) => b.count - a.count);

  return {
    total,
    selected,
    rejected,
    withdrawn,
    inProgress: total - selected - rejected - withdrawn,
    conversionRate: total ? selected / total : 0,
    byStage,
    byCountry: byCountryGroups.map((g) => ({ country: g.country, count: g._count._all })),
    recent,
  };
}

// ------------------------------------------------------------------
// Program Ecosystem: per-university and per-operator breakdowns.
// ------------------------------------------------------------------

/**
 * Always lists the full fixed partner roster (every University/Operator row), not just
 * the ones with in-scope scholars — counts default to 0 for a partner with no matches.
 * evaluationResults/surveyResults are explicitly null: neither has a confirmed data source.
 */
export async function getProgramEcosystem(
  filters: DashboardFilters = {},
): Promise<ProgramEcosystemResult> {
  const { scholars, riskMap } = await loadScope(filters);

  const [allUniversities, allOperators] = await Promise.all([
    prisma.university.findMany({ orderBy: [{ country: "asc" }, { name: "asc" }] }),
    prisma.operator.findMany({ orderBy: [{ track: "asc" }, { name: "asc" }] }),
  ]);

  const universityStats = new Map<
    string,
    {
      scholarCount: number;
      activeScholarCount: number;
      dropOutCount: number;
      cohorts: Set<string>;
      riskDistribution: RiskDistribution;
    }
  >();
  const operatorScholarCounts = new Map<string, number>();

  for (const s of scholars) {
    let uStat = universityStats.get(s.universityId);
    if (!uStat) {
      uStat = {
        scholarCount: 0,
        activeScholarCount: 0,
        dropOutCount: 0,
        cohorts: new Set<string>(),
        riskDistribution: emptyRiskDistribution(),
      };
      universityStats.set(s.universityId, uStat);
    }
    uStat.scholarCount += 1;
    if (s.programStatus === ProgramStatus.ACTIVE) uStat.activeScholarCount += 1;
    if (s.programStatus === ProgramStatus.WITHDRAWN) uStat.dropOutCount += 1;
    if (s.cohort?.trim()) uStat.cohorts.add(s.cohort.trim());
    const level = riskMap.get(s.scholarId)?.globalRiskLevel;
    if (level) uStat.riskDistribution[level] += 1;

    if (s.operatorId) {
      operatorScholarCounts.set(s.operatorId, (operatorScholarCounts.get(s.operatorId) ?? 0) + 1);
    }
  }

  const universities = allUniversities.map((u) => {
    const stat = universityStats.get(u.id) ?? {
      scholarCount: 0,
      activeScholarCount: 0,
      dropOutCount: 0,
      cohorts: new Set<string>(),
      riskDistribution: emptyRiskDistribution(),
    };
    return {
      universityId: u.id,
      name: u.name,
      city: u.city,
      country: u.country,
      type: u.type,
      semesterStartDate: u.semesterStartDate,
      semesterEndDate: u.semesterEndDate,
      examWindowStart: u.examWindowStart,
      examWindowEnd: u.examWindowEnd,
      scholarCount: stat.scholarCount,
      activeScholarCount: stat.activeScholarCount,
      dropOutCount: stat.dropOutCount,
      cohorts: [...stat.cohorts].sort(),
      riskDistribution: stat.riskDistribution,
      evaluationResults: null,
    };
  });

  const operators = allOperators.map((o) => ({
    operatorId: o.id,
    name: o.name,
    country: o.country,
    track: o.track,
    scholarCount: operatorScholarCounts.get(o.id) ?? 0,
    surveyResults: null,
  }));

  return { universities, operators };
}

// ------------------------------------------------------------------
// 9.10 AUGUST 4 home sections
// ------------------------------------------------------------------

/** Every scholar in scope regardless of status — the "selected" population. */
async function loadAllStatuses(filters: DashboardFilters) {
  return prisma.scholar.findMany({
    where: geoScholarWhere(filters),
    select: {
      scholarId: true,
      cohort: true,
      country: true,
      gender: true,
      programStatus: true,
      socioeconomicLevel: true,
      departmentOrigin: true,
      academicProgress: true,
      currentEnglishLevel: true,
      university: { select: { name: true } },
    },
    orderBy: { scholarId: "asc" },
  });
}

const pct = (n: number, d: number) => (d ? Math.round((n / d) * 100) : 0);

/**
 * §1 Our Scholars.
 *
 * "Selected" is every scholar on record. ProgramStatus is only
 * ACTIVE/WITHDRAWN/GRADUATED/PAUSED and the sheet carries just "BECARIO(A) ACTIVO"
 * and "DESERTOR(A)", so there is no admitted-but-never-started state to separate out
 * — the distinction the design draws is simply everyone vs. those still active.
 */
export async function getScholarBaseCounts(
  filters: DashboardFilters = {},
): Promise<ScholarBaseCounts> {
  const scholars = await loadAllStatuses(filters);
  const active = scholars.filter((s) => s.programStatus === ProgramStatus.ACTIVE);
  const women = active.filter((s) => normalizeGender(s.gender) === "female");

  const byKey = new Map<string, { cohort: string; country: Country; selected: number; active: number }>();
  for (const s of scholars) {
    const key = `${s.cohort}::${s.country}`;
    const row = byKey.get(key) ?? { cohort: s.cohort, country: s.country, selected: 0, active: 0 };
    row.selected += 1;
    if (s.programStatus === ProgramStatus.ACTIVE) row.active += 1;
    byKey.set(key, row);
  }

  return {
    selectedTotal: scholars.length,
    activeTotal: active.length,
    cohortCount: new Set(scholars.map((s) => s.cohort)).size,
    womenActive: {
      total: women.length,
      colombia: women.filter((s) => s.country === Country.COLOMBIA).length,
      peru: women.filter((s) => s.country === Country.PERU).length,
    },
    byCohortCountry: [...byKey.values()].sort(
      (a, b) => a.cohort.localeCompare(b.cohort) || a.country.localeCompare(b.country),
    ),
  };
}

/**
 * §2 Drop Outs.
 *
 * `reasons` is null, not an empty list. No source carries a dropout reason: the sheet
 * has no such column, and the mentor-report alert types only cover the current
 * semester, so they say nothing about scholars who left in 2024 or 2025.
 */
export async function getDropoutOverview(
  filters: DashboardFilters = {},
): Promise<DropoutOverview> {
  const scholars = await loadAllStatuses(filters);
  const withdrawn = scholars.filter((s) => s.programStatus === ProgramStatus.WITHDRAWN);
  return {
    withdrawnTotal: withdrawn.length,
    withdrawnWomen: withdrawn.filter((s) => normalizeGender(s.gender) === "female").length,
    selectedTotal: scholars.length,
    withdrawnPct: pct(withdrawn.length, scholars.length),
    reasons: null,
  };
}

/**
 * §3 Program Retention — point in time, per cohort and country.
 *
 * `perTerm` is null on purpose. The design shows retention advancing term by term, but
 * AcademicTerm.enrollmentStatus cannot support that: "Not applicable for this semester"
 * means both "had not started yet" and "already left", the sheet forward-fills terms
 * that have not happened, and some withdrawn scholars still read as enrolled in future
 * terms. A survival curve built on it would be invented. It needs an explicit exit term
 * on Scholar, which is a source-sheet change first.
 *
 * Retention is over the settled population (active + withdrawn); paused and graduated
 * scholars are not a retention outcome either way.
 */
export async function getCohortRetention(
  filters: DashboardFilters = {},
): Promise<CohortRetention> {
  const scholars = await loadAllStatuses(filters);
  const settledOnly = scholars.filter(
    (s) =>
      s.programStatus === ProgramStatus.ACTIVE || s.programStatus === ProgramStatus.WITHDRAWN,
  );

  const byKey = new Map<string, { cohort: string; country: Country; settled: number; active: number }>();
  for (const s of settledOnly) {
    const key = `${s.cohort}::${s.country}`;
    const row = byKey.get(key) ?? { cohort: s.cohort, country: s.country, settled: 0, active: 0 };
    row.settled += 1;
    if (s.programStatus === ProgramStatus.ACTIVE) row.active += 1;
    byKey.set(key, row);
  }

  const rows = [...byKey.values()]
    .map((r) => ({ ...r, retentionPct: pct(r.active, r.settled) }))
    .sort((a, b) => a.cohort.localeCompare(b.cohort) || a.country.localeCompare(b.country));

  const rollup = (subset: typeof settledOnly) => {
    const active = subset.filter((s) => s.programStatus === ProgramStatus.ACTIVE).length;
    return { settled: subset.length, active, retentionPct: pct(active, subset.length) };
  };

  const years = [...new Set(settledOnly.map((s) => cohortYear(s.cohort)).filter(Boolean))].sort() as string[];

  return {
    rows,
    overall: settledOnly.length ? rollup(settledOnly) : null,
    byCohortYear: years.map((year) => ({
      year,
      retentionPct: rollup(settledOnly.filter((s) => cohortYear(s.cohort) === year)).retentionPct,
    })),
    byCountry: (Object.values(Country) as Country[])
      .map((country) => ({
        country,
        subset: settledOnly.filter((s) => s.country === country),
      }))
      .filter((g) => g.subset.length > 0)
      .map((g) => ({ country: g.country, retentionPct: rollup(g.subset).retentionPct })),
    perTerm: null,
    target: null,
  };
}

const emptyTierCounts = (): Record<SocioeconomicTier, number> => ({ TIER_1: 0, TIER_2: 0, TIER_3: 0 });

/** §4 Vulnerability tiers. Renders as pending while the tier wording is unapproved. */
export async function getVulnerabilityTiers(
  filters: DashboardFilters = {},
): Promise<VulnerabilityTiers> {
  const scholars = await loadAllStatuses(filters);

  const tally = (subset: typeof scholars) => {
    const counts = emptyTierCounts();
    let unclassified = 0;
    for (const s of subset) {
      const { tier } = parseSocioeconomicTier(s.socioeconomicLevel);
      if (tier) counts[tier] += 1;
      else unclassified += 1;
    }
    const classified = counts.TIER_1 + counts.TIER_2 + counts.TIER_3;
    return {
      counts,
      classified,
      unclassified,
      pct: {
        TIER_1: pct(counts.TIER_1, classified),
        TIER_2: pct(counts.TIER_2, classified),
        TIER_3: pct(counts.TIER_3, classified),
      },
    };
  };

  const keys = [...new Set(scholars.map((s) => `${s.cohort}::${s.country}`))].sort();
  return {
    mappingApproved: TIER_MAPPING_APPROVED,
    rows: keys.map((key) => {
      const [cohort, country] = key.split("::");
      return {
        cohort,
        country: country as Country,
        ...tally(scholars.filter((s) => `${s.cohort}::${s.country}` === key)),
      };
    }),
    overall: scholars.length ? tally(scholars) : null,
  };
}

/** §5 Where Our Scholars Are From — origin x cohort year, per country. */
export async function getOriginBreakdown(
  filters: DashboardFilters = {},
): Promise<OriginBreakdown> {
  const scholars = await loadAllStatuses(filters);
  const TOP_ORIGINS = 4;

  const matrix = (country: Country): OriginMatrix => {
    const subset = scholars.filter((s) => s.country === country);
    const years = [...new Set(subset.map((s) => cohortYear(s.cohort)).filter(Boolean))].sort() as string[];

    const byOrigin = new Map<string, { origin: string; counts: Record<string, number>; total: number }>();
    let notReported = 0;
    for (const s of subset) {
      const origin = normalizeOrigin(s.departmentOrigin);
      const year = cohortYear(s.cohort);
      if (!origin || !year) {
        notReported += 1;
        continue;
      }
      const key = originKey(origin);
      const row =
        byOrigin.get(key) ??
        { origin, counts: Object.fromEntries(years.map((y) => [y, 0])), total: 0 };
      row.counts[year] = (row.counts[year] ?? 0) + 1;
      row.total += 1;
      byOrigin.set(key, row);
    }

    const sorted = [...byOrigin.values()].sort((a, b) => b.total - a.total || a.origin.localeCompare(b.origin));
    const head = sorted.slice(0, TOP_ORIGINS);
    const tail = sorted.slice(TOP_ORIGINS);
    if (tail.length > 0) {
      // Colombia reports departments, Peru regions — the tail bucket has to match.
      const tailLabel = country === Country.COLOMBIA ? "Other departments" : "Other regions";
      head.push({
        origin: tail.length === 1 ? tail[0].origin : tailLabel,
        counts: Object.fromEntries(
          years.map((y) => [y, tail.reduce((n, r) => n + (r.counts[y] ?? 0), 0)]),
        ),
        total: tail.reduce((n, r) => n + r.total, 0),
      });
    }

    return {
      cohortYears: years,
      rows: head,
      total: {
        counts: Object.fromEntries(
          years.map((y) => [y, head.reduce((n, r) => n + (r.counts[y] ?? 0), 0)]),
        ),
        total: head.reduce((n, r) => n + r.total, 0),
      },
      notReported,
    };
  };

  return { colombia: matrix(Country.COLOMBIA), peru: matrix(Country.PERU) };
}

/** §7 Retention & dropout per university, worst dropout first, colour-banded. */
export async function getUniversityRetention(
  filters: DashboardFilters = {},
): Promise<UniversityRetentionRow[]> {
  const scholars = await prisma.scholar.findMany({
    where: geoScholarWhere(filters),
    select: { programStatus: true, country: true, university: { select: { name: true } } },
  });

  const agg = new Map<string, { country: Country; active: number; dropout: number }>();
  for (const s of scholars) {
    const name = s.university?.name;
    if (!name) continue;
    const row = agg.get(name) ?? { country: s.country, active: 0, dropout: 0 };
    if (s.programStatus === ProgramStatus.ACTIVE) row.active += 1;
    else if (s.programStatus === ProgramStatus.WITHDRAWN) row.dropout += 1;
    agg.set(name, row);
  }

  return [...agg.entries()]
    .filter(([, r]) => r.active + r.dropout > 0)
    .map(([name, r]) => {
      const settled = r.active + r.dropout;
      const retentionPct = pct(r.active, settled);
      const dropOutPct = 100 - retentionPct;
      return {
        name,
        country: r.country,
        activeCount: r.active,
        dropOutCount: r.dropout,
        retentionPct,
        dropOutPct,
        band: dropoutBand(dropOutPct),
      };
    })
    .sort((a, b) => b.dropOutPct - a.dropOutPct || a.name.localeCompare(b.name));
}

/** §8.1 Academic progress by country, from Scholar.academicProgress. */
export async function getAcademicProgressByCountry(
  filters: DashboardFilters = {},
): Promise<AcademicProgressByCountryRow[]> {
  const scholars = (await loadAllStatuses(filters)).filter(
    (s) => s.programStatus === ProgramStatus.ACTIVE,
  );

  const tally = (subset: typeof scholars, country: Country | "ALL"): AcademicProgressByCountryRow => {
    const row: AcademicProgressByCountryRow = {
      country,
      onTrack: 0,
      behind: 0,
      critical: 0,
      classified: 0,
      pending: 0,
      notApplicable: 0,
      unknown: 0,
    };
    for (const s of subset) {
      switch (parseScholarProgress(s.academicProgress)) {
        case "ON_TRACK": row.onTrack += 1; row.classified += 1; break;
        case "BEHIND": row.behind += 1; row.classified += 1; break;
        case "CRITICAL": row.critical += 1; row.classified += 1; break;
        case "PENDING": row.pending += 1; break;
        case "NOT_APPLICABLE": row.notApplicable += 1; break;
        default: row.unknown += 1;
      }
    }
    return row;
  };

  const rows = (Object.values(Country) as Country[])
    .map((c) => tally(scholars.filter((s) => s.country === c), c))
    .filter((r) => r.classified + r.pending + r.notApplicable + r.unknown > 0);
  if (scholars.length > 0) rows.push(tally(scholars, "ALL"));
  return rows;
}

const emptyEnglishCounts = (): Record<EnglishLevel, number> =>
  Object.fromEntries(ENGLISH_LEVELS.map((l) => [l, 0])) as Record<EnglishLevel, number>;

/** §8.2 English level by country. Percentages must be shown over `classified`. */
export async function getEnglishLevelByCountry(
  filters: DashboardFilters = {},
): Promise<EnglishLevelByCountryRow[]> {
  const scholars = (await loadAllStatuses(filters)).filter(
    (s) => s.programStatus === ProgramStatus.ACTIVE,
  );

  const tally = (subset: typeof scholars, country: Country | "ALL"): EnglishLevelByCountryRow => {
    const row: EnglishLevelByCountryRow = {
      country,
      counts: emptyEnglishCounts(),
      classified: 0,
      pending: 0,
      notApplicable: 0,
      unrecognized: 0,
    };
    for (const s of subset) {
      const parsed = parseEnglishLevel(s.currentEnglishLevel);
      if (parsed.status === "OK") {
        row.counts[parsed.level] += 1;
        row.classified += 1;
      } else if (parsed.status === "PENDING") row.pending += 1;
      else if (parsed.status === "NOT_APPLICABLE") row.notApplicable += 1;
      else row.unrecognized += 1;
    }
    return row;
  };

  const rows = (Object.values(Country) as Country[])
    .map((c) => tally(scholars.filter((s) => s.country === c), c))
    .filter((r) => r.classified + r.pending + r.notApplicable + r.unrecognized > 0);
  if (scholars.length > 0) rows.push(tally(scholars, "ALL"));
  return rows;
}

/**
 * §8.3/8.4 Average GPA by cohort, per country, never blended across scales.
 *
 * Reads AcademicTerm.gpa, which the sheet sync does emit — not accumulatedGpa, which it
 * does not. Terms a scholar was not enrolled in are stored as a literal 0, and
 * summarizeGpa treats 0 as a valid GPA, so those are excluded explicitly and counted.
 */
export async function getGpaByCohort(filters: DashboardFilters = {}): Promise<GpaByCohort> {
  const scholars = await prisma.scholar.findMany({
    where: { AND: [geoScholarWhere(filters), { programStatus: ProgramStatus.ACTIVE }] },
    select: { scholarId: true, cohort: true, country: true },
  });
  const terms = await prisma.academicTerm.findMany({
    where: { scholarId: { in: scholars.map((s) => s.scholarId) } },
    select: { scholarId: true, term: true, gpa: true },
    orderBy: { term: "asc" },
  });

  // One GPA per scholar: their latest term with a real, in-scale, non-zero grade.
  const byCountry = new Map(scholars.map((s) => [s.scholarId, s]));
  const latest = new Map<string, number>();
  let excludedZeroGpaCount = 0;
  for (const t of terms) {
    const scholar = byCountry.get(t.scholarId);
    if (!scholar || t.gpa == null || !Number.isFinite(t.gpa)) continue;
    if (t.gpa === 0) {
      excludedZeroGpaCount += 1;
      continue;
    }
    if (t.gpa < 0 || t.gpa > GPA_SCALE_MAX[scholar.country]) continue;
    latest.set(t.scholarId, t.gpa); // terms are ascending, so the last write wins
  }

  const side = (country: Country) => {
    const subset = scholars.filter((s) => s.country === country);
    const cohorts = [...new Set(subset.map((s) => s.cohort))].sort();
    const rows = cohorts.map((cohort) => {
      const grades = subset
        .filter((s) => s.cohort === cohort)
        .map((s) => latest.get(s.scholarId))
        .filter((g): g is number => g != null);
      return {
        cohort,
        average: grades.length ? round2(grades.reduce((a, b) => a + b, 0) / grades.length) : null,
        count: grades.length,
      };
    });
    const all = subset.map((s) => latest.get(s.scholarId)).filter((g): g is number => g != null);
    return {
      scale: GPA_SCALE_MAX[country],
      rows: rows.filter((r) => r.count > 0),
      overall: all.length ? round2(all.reduce((a, b) => a + b, 0) / all.length) : null,
    };
  };

  return {
    colombia: side(Country.COLOMBIA),
    peru: side(Country.PERU),
    excludedZeroGpaCount,
  };
}

// ------------------------------------------------------------------
// 9.11 AUGUST 4 early-support sections
// ------------------------------------------------------------------

/**
 * §2.2 Why scholars are at risk.
 *
 * Reads the two "situación específica" multi-selects already synced onto MentorReport,
 * grouped by the taxonomy in lib/risk/reason-taxonomy.ts.
 *
 * Counts SCHOLARS, not report rows or selected options: a scholar with two options in
 * the same reason counts once for that reason, and one who was reported twice in the
 * period counts once overall.
 *
 * The two axes are reported independently because they overlap for most at-risk
 * scholars. Do not add the two tables together.
 */
export async function getRiskReasonBreakdown(
  filters: DashboardFilters = {},
): Promise<RiskReasonBreakdown> {
  const { currentPeriod, scholars, riskMap } = await loadScope(filters);

  const atRisk = scholars.filter((s) => {
    if (!riskEligible(s)) return false;
    const level = riskMap.get(s.scholarId)?.globalRiskLevel;
    return level != null && riskTier(level) !== "LOW";
  });
  const atRiskIds = atRisk.map((s) => s.scholarId);

  const reports = atRiskIds.length
    ? await prisma.mentorReport.findMany({
        where: { scholarId: { in: atRiskIds } },
        select: {
          scholarId: true,
          reportingMonth: true,
          academicAlertType: true,
          psychosocialAlertType: true,
        },
      })
    : [];
  const inPeriod = reports.filter((r) => (r.reportingMonth ?? currentPeriod) === currentPeriod);

  // scholarId -> the reasons they were flagged with, per axis.
  const byAxis: Record<RiskAxis, Map<string, Set<RiskReasonCategory>>> = {
    academic: new Map(),
    psychosocial: new Map(),
  };
  const unmapped = new Set<string>();
  const unclassifiedOnly = new Set<string>();
  const anyAtomSeen = new Set<string>();

  for (const r of inPeriod) {
    for (const axis of ["academic", "psychosocial"] as RiskAxis[]) {
      const raw = axis === "academic" ? r.academicAlertType : r.psychosocialAlertType;
      for (const atom of splitAlertAtoms(raw)) {
        anyAtomSeen.add(r.scholarId);
        const category = categorizeAlertAtom(atom, axis);
        if (!category) {
          unmapped.add(normalizeAlertAtom(atom));
          unclassifiedOnly.add(r.scholarId);
          continue;
        }
        const set = byAxis[axis].get(r.scholarId) ?? new Set<RiskReasonCategory>();
        set.add(category);
        byAxis[axis].set(r.scholarId, set);
      }
    }
  }

  const axisResult = (axis: RiskAxis): RiskReasonAxis => {
    const scholarsOnAxis = byAxis[axis];
    const counts = new Map<RiskReasonCategory, number>();
    for (const categories of scholarsOnAxis.values()) {
      for (const c of categories) counts.set(c, (counts.get(c) ?? 0) + 1);
    }
    const denominator = scholarsOnAxis.size;
    return {
      scholarsWithAnyReason: denominator,
      rows: CATEGORIES_BY_AXIS[axis]
        .map((category) => ({
          category,
          label: RISK_REASON_LABEL[category],
          scholarCount: counts.get(category) ?? 0,
          pct: denominator ? Math.round(((counts.get(category) ?? 0) / denominator) * 100) : 0,
        }))
        .filter((r) => r.scholarCount > 0)
        .sort((a, b) => b.scholarCount - a.scholarCount),
    };
  };

  let bothAxesCount = 0;
  for (const id of byAxis.academic.keys()) {
    if (byAxis.psychosocial.has(id)) bothAxesCount += 1;
  }

  // Only count a scholar as unclassified if NONE of their options were classified.
  let unclassifiedScholarCount = 0;
  for (const id of unclassifiedOnly) {
    if (!byAxis.academic.has(id) && !byAxis.psychosocial.has(id)) unclassifiedScholarCount += 1;
  }

  return {
    period: currentPeriod,
    atRiskScholarCount: atRisk.length,
    academic: axisResult("academic"),
    psychosocial: axisResult("psychosocial"),
    unclassifiedScholarCount,
    unmappedAtoms: [...unmapped].sort(),
    bothAxesCount,
  };
}

/**
 * §2.3 Participation by activity group and risk tier.
 *
 * A caveat worth carrying into the UI: these counts are `Int @default(0)` on
 * MentorReport, so a blank cell and a real zero are indistinguishable at this grain.
 * The "blank is not zero" rule in the sync contract applies to SupportActivity rows,
 * not to these columns. Every percentage therefore ships with its denominator.
 */
export async function getParticipationByActivityAndRisk(
  filters: DashboardFilters = {},
): Promise<ParticipationByActivityAndRisk> {
  const { currentPeriod, scholars, riskMap } = await loadScope(filters);
  const eligible = scholars.filter(riskEligible);

  const tierOf = new Map<string, RiskTier>();
  for (const s of eligible) {
    const level = riskMap.get(s.scholarId)?.globalRiskLevel;
    if (level != null) tierOf.set(s.scholarId, riskTier(level));
  }

  const reports = tierOf.size
    ? await prisma.mentorReport.findMany({
        where: { scholarId: { in: [...tierOf.keys()] } },
        select: {
          scholarId: true,
          reportingMonth: true,
          individualTutoring: true,
          groupTutoring: true,
          individualMentoring: true,
          groupMentoring: true,
          workshops: true,
        },
      })
    : [];
  const inPeriod = reports.filter((r) => (r.reportingMonth ?? currentPeriod) === currentPeriod);

  return {
    period: currentPeriod,
    groups: ACTIVITY_GROUP_ORDER.map((activity) => {
      const participated = new Set<string>();
      for (const r of inPeriod) {
        const total = ACTIVITY_GROUP_COLUMNS[activity].reduce((n, col) => n + (r[col] ?? 0), 0);
        if (total > 0) participated.add(r.scholarId);
      }
      return {
        activity,
        rows: RISK_TIER_ORDER.map((tier) => {
          const ids = [...tierOf.entries()].filter(([, t]) => t === tier).map(([id]) => id);
          const participatedCount = ids.filter((id) => participated.has(id)).length;
          return {
            tier,
            scholarCount: ids.length,
            participatedCount,
            pct: ids.length ? Math.round((participatedCount / ids.length) * 100) : null,
          };
        }),
      };
    }),
  };
}

/** §2.5 Risk tier by gender. */
export async function getRiskByGender(
  filters: DashboardFilters = {},
): Promise<RiskByGenderRow[]> {
  const { scholars, riskMap } = await loadScope(filters);
  const eligible = scholars.filter(riskEligible);

  const genders: RiskByGenderRow["gender"][] = ["female", "male", "other"];
  return genders
    .map((gender) => {
      const subset = eligible.filter((s) => normalizeGender(s.gender) === gender);
      const tiers: Record<RiskTier, number> = { LOW: 0, MEDIUM: 0, HIGH_CRITICAL: 0 };
      let assessed = 0;
      for (const s of subset) {
        const level = riskMap.get(s.scholarId)?.globalRiskLevel;
        if (level == null) continue;
        tiers[riskTier(level)] += 1;
        assessed += 1;
      }
      return {
        gender,
        scholarCount: assessed,
        tiers,
        tierPct: {
          LOW: assessed ? Math.round((tiers.LOW / assessed) * 100) : 0,
          MEDIUM: assessed ? Math.round((tiers.MEDIUM / assessed) * 100) : 0,
          HIGH_CRITICAL: assessed ? Math.round((tiers.HIGH_CRITICAL / assessed) * 100) : 0,
        },
      };
    })
    .filter((r) => r.scholarCount > 0);
}

/**
 * §1 Contact prioritisation — at-risk scholars with the details needed to reach them,
 * highest risk first.
 *
 * Goes through loadScope with the caller's access filter, so a mentor sees only their
 * own assigned scholars. That matters more here than anywhere else on the dashboard:
 * this is the one view that puts personal email addresses and phone numbers on screen.
 */
export async function getContactPriority(
  filters: DashboardFilters = {},
  user: CurrentUser | null = null,
): Promise<ContactPriorityRow[]> {
  const { scholars, riskMap } = await loadScope(filters, scholarAccessWhere(user));

  return scholars
    .filter((s) => s.programStatus === ProgramStatus.ACTIVE)
    .map((s) => {
      const risk = riskMap.get(s.scholarId);
      return { scholar: s, risk };
    })
    .filter((r) => r.risk != null && riskTier(r.risk.globalRiskLevel) !== "LOW")
    .map(({ scholar, risk }) => ({
      scholarId: scholar.scholarId,
      fullName: scholar.fullName,
      email: scholar.email1 ?? scholar.email2 ?? null,
      mobilePhone: scholar.mobilePhone ?? null,
      university: scholar.university.name,
      cohort: scholar.cohort,
      country: scholar.country,
      riskLevel: risk!.globalRiskLevel,
      riskValue: risk!.globalRiskValue,
    }))
    .sort((a, b) => b.riskValue - a.riskValue || a.fullName.localeCompare(b.fullName));
}
