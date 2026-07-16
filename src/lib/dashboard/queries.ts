// Dashboard query layer — reusable, typed server-side reads for every dashboard view.
// Aggregation is done in JS over Prisma results: the dataset is small (~100 scholars) and
// this keeps the logic readable and testable. Optimize with SQL only if data volume grows.
import { deriveExpectedProgressStatus } from "../academic/progress";
import { prisma } from "../db";
import type { AcademicTerm, Prisma, RiskAssessment, Scholar } from "../../generated/prisma/client";
import {
  AcademicProgressStatus,
  ActivityType,
  Country,
  ProgramStatus,
  RiskLevel,
  SelectionStage,
} from "../../generated/prisma/enums";
import type {
  AcademicProgressResult,
  CostGroup,
  DashboardFilters,
  ExecutiveOverview,
  FilterOptions,
  GpaGroupStat,
  HomeOverview,
  ProgressDistribution,
  RiskAlertRow,
  RiskAlertsResult,
  RiskDistribution,
  ScholarDirectoryRow,
  SelectionPipelineResult,
  StageCount,
  SupportParticipationResult,
  UnitEconomicsResult,
} from "./types";
import { latestCohort } from "./cohort";
import { normalizeGender } from "./gender";

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
  };
}
/** Scholar where-clause excluding status/risk/period (geography + demographics only). */
function geoScholarWhere(filters: DashboardFilters): Prisma.ScholarWhereInput {
  return {
    ...(filters.country ? { country: filters.country } : {}),
    ...(filters.cohort ? { cohort: filters.cohort } : {}),
    ...(filters.university ? { university: filters.university } : {}),
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

async function getCurrentPeriod(): Promise<string> {
  const latest = await prisma.riskAssessment.aggregate({ _max: { period: true } });
  return latest._max.period ?? "2026-06";
}

/** Distinct values that populate the dashboard filter dropdowns. */
export async function getFilterOptions(): Promise<FilterOptions> {
  const [scholars, periods] = await Promise.all([
    prisma.scholar.findMany({ select: { cohort: true, university: true } }),
    prisma.riskAssessment.findMany({
      select: { period: true },
      distinct: ["period"],
      orderBy: { period: "asc" },
    }),
  ]);
  return {
    cohorts: [...new Set(scholars.map((s) => s.cohort))].sort(),
    universities: [...new Set(scholars.map((s) => s.university))].sort(),
    periods: periods.map((p) => p.period),
  };
}

/** Each scholar's current risk = latest assessment with period <= currentPeriod. */
async function currentRiskByScholar(
  scholarIds: string[],
  currentPeriod: string,
): Promise<Map<string, RiskAssessment>> {
  const map = new Map<string, RiskAssessment>();
  if (scholarIds.length === 0) return map;
  const rows = await prisma.riskAssessment.findMany({
    where: { scholarId: { in: scholarIds }, period: { lte: currentPeriod } },
    orderBy: { period: "asc" },
  });
  for (const row of rows) map.set(row.scholarId, row); // ascending → last write is latest
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

/** Shared scope: filtered scholars (incl. riskLevel), their current risk, and report sets. */
async function loadScope(filters: DashboardFilters) {
  const currentPeriod = filters.period ?? (await getCurrentPeriod());
  let scholars: Scholar[] = await prisma.scholar.findMany({
    where: scholarWhere(filters),
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

  // Average GPA from each scholar's latest accumulated GPA.
  const latestTerms = await latestTermByScholar(ids);
  const gpas = [...latestTerms.values()]
    .map((t) => t.accumulatedGpa)
    .filter((g): g is number => g !== null);

  // Risk distribution + scholars needing attention.
  const riskDistribution = emptyRiskDistribution();
  let needingAttention = 0;
  for (const s of scholars) {
    const cur = riskMap.get(s.scholarId);
    if (cur) riskDistribution[cur.globalRiskLevel] += 1;
    const active = s.programStatus === ProgramStatus.ACTIVE;
    const highRisk = (cur?.globalRiskValue ?? 0) >= 2;
    const missing = active && (!checkinSet.has(s.scholarId) || !mentorSet.has(s.scholarId));
    if (highRisk || missing) needingAttention += 1;
  }

  // Participation: active scholars with meaningful engagement (> 3 support activities), in scope.
  const activeIds = scholars
    .filter((s) => s.programStatus === ProgramStatus.ACTIVE)
    .map((s) => s.scholarId);
  const supportRows = activeIds.length
    ? await prisma.supportActivity.findMany({
        where: { scholarId: { in: activeIds } },
        select: { scholarId: true, activityCount: true },
      })
    : [];
  const activityTotals = new Map<string, number>();
  for (const r of supportRows) {
    activityTotals.set(r.scholarId, (activityTotals.get(r.scholarId) ?? 0) + r.activityCount);
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
    retentionRate: total ? round2(retained / total) : 0,
    averageGpa: mean(gpas),
    participationRate: round2(participationRate),
    scholarsNeedingAttention: needingAttention,
    riskDistribution,
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

  // Women % among active scholars with a recognized gender (unknown excluded from denominator).
  const classified = active
    .map((s) => normalizeGender(s.gender))
    .filter((g) => g !== "unknown");
  const womenPercentage = classified.length
    ? round2(classified.filter((g) => g === "female").length / classified.length)
    : null;

  // "Selected or latest cohort": honor an active cohort filter, else the latest present.
  const cohort = filters.cohort ?? latestCohort(active.map((s) => s.cohort));
  const cohortCount = cohort ? active.filter((s) => s.cohort === cohort).length : 0;

  const activeUniversityCount = new Set(
    active.map((s) => s.university?.trim()).filter((u): u is string => !!u),
  ).size;

  return {
    scholarsByCountry,
    womenPercentage,
    cohortSpotlight: { cohort, count: cohortCount },
    activeUniversityCount,
  };
}

// ------------------------------------------------------------------
// 9.2 Risk & alerts
// ------------------------------------------------------------------
export async function getRiskAlerts(filters: DashboardFilters = {}): Promise<RiskAlertsResult> {
  const { currentPeriod, scholars, riskMap, checkinSet, mentorSet } = await loadScope(filters);

  const distribution = emptyRiskDistribution();
  const attentionList: RiskAlertRow[] = [];

  for (const s of scholars) {
    const cur = riskMap.get(s.scholarId);
    if (cur) distribution[cur.globalRiskLevel] += 1;

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
      university: s.university,
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
    });
  }

  attentionList.sort(
    (a, b) => b.globalRiskValue - a.globalRiskValue || (b.riskChange ?? 0) - (a.riskChange ?? 0),
  );
  return { currentPeriod, distribution, attentionList };
}

/** Scholar list for the directory/search page (current risk + latest GPA). */
export async function getScholarDirectory(
  filters: DashboardFilters = {},
  search?: string,
): Promise<ScholarDirectoryRow[]> {
  const { scholars, riskMap } = await loadScope(filters);
  const q = search?.trim().toLowerCase();
  const list = q
    ? scholars.filter(
        (s) => s.fullName.toLowerCase().includes(q) || s.scholarId.toLowerCase().includes(q),
      )
    : scholars;
  const gpaMap = await latestTermByScholar(list.map((s) => s.scholarId));
  return list.map((s) => ({
    scholarId: s.scholarId,
    fullName: s.fullName,
    country: s.country,
    cohort: s.cohort,
    university: s.university,
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
export async function getScholarProfile(scholarId: string) {
  const scholar = await prisma.scholar.findUnique({
    where: { scholarId },
    include: {
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
): Promise<AcademicProgressResult> {
  const { scholars, riskMap } = await loadScope(filters);
  const ids = scholars.map((s) => s.scholarId);
  const latestTerms = await latestTermByScholar(ids);

  const gpaByCohort = new Map<string, number[]>();
  const gpaByCountry = new Map<string, number[]>();
  const gpaByUniversity = new Map<string, number[]>();
  const progressStatusDistribution = emptyProgressDistribution();
  const academicRiskDistribution = emptyRiskDistribution();
  const scholarsBehind: AcademicProgressResult["scholarsBehind"] = [];
  const allGpas: number[] = [];
  let scholarsWithFailedSubjects = 0;

  for (const s of scholars) {
    const term = latestTerms.get(s.scholarId);
    if (term?.accumulatedGpa != null) {
      const g = term.accumulatedGpa;
      allGpas.push(g);
      pushTo(gpaByCohort, s.cohort, g);
      pushTo(gpaByCountry, s.country, g);
      pushTo(gpaByUniversity, s.university, g);
    }

    const status =
      term?.expectedProgressStatus ??
      (term && term.progressPercentage != null
        ? deriveExpectedProgressStatus(term.progressPercentage, 100)
        : null);
    if (status) progressStatusDistribution[status] += 1;

    const cur = riskMap.get(s.scholarId);
    if (cur) academicRiskDistribution[cur.academicRiskLevel] += 1;

    if ((term?.failedSubjectsCount ?? 0) > 0) scholarsWithFailedSubjects += 1;

    if (status === AcademicProgressStatus.BEHIND || status === AcademicProgressStatus.CRITICAL_DELAY) {
      scholarsBehind.push({
        scholarId: s.scholarId,
        fullName: s.fullName,
        cohort: s.cohort,
        country: s.country,
        university: s.university,
        latestTerm: term?.term ?? null,
        progressPercentage: term?.progressPercentage ?? null,
        expectedProgressStatus: status,
        failedSubjectsCount: term?.failedSubjectsCount ?? null,
      });
    }
  }

  const toGroupStats = (m: Map<string, number[]>): GpaGroupStat[] =>
    [...m.entries()]
      .map(([key, gpas]) => ({ key, scholarCount: gpas.length, averageGpa: mean(gpas) }))
      .sort((a, b) => a.key.localeCompare(b.key));

  scholarsBehind.sort((a, b) => (a.progressPercentage ?? 0) - (b.progressPercentage ?? 0));

  return {
    averageGpa: mean(allGpas),
    gpaByCohort: toGroupStats(gpaByCohort),
    gpaByCountry: toGroupStats(gpaByCountry),
    gpaByUniversity: toGroupStats(gpaByUniversity),
    progressStatusDistribution,
    academicRiskDistribution,
    scholarsBehind,
    scholarsWithFailedSubjects,
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

  const activities = ids.length
    ? await prisma.supportActivity.findMany({ where: { scholarId: { in: ids } } })
    : [];

  const byType = new Map<ActivityType, number>(
    Object.values(ActivityType).map((t) => [t, 0]),
  );
  const byMonth = new Map<string, number>();
  const totalByScholar = new Map<string, number>();
  for (const a of activities) {
    byType.set(a.activityType, (byType.get(a.activityType) ?? 0) + a.activityCount);
    byMonth.set(a.period, (byMonth.get(a.period) ?? 0) + a.activityCount);
    totalByScholar.set(a.scholarId, (totalByScholar.get(a.scholarId) ?? 0) + a.activityCount);
  }

  // Participation by current risk level.
  const perLevelTotals = emptyRiskDistribution();
  const perLevelCounts = emptyRiskDistribution();
  for (const s of scholars) {
    const level = riskMap.get(s.scholarId)?.globalRiskLevel;
    if (!level) continue;
    perLevelCounts[level] += 1;
    perLevelTotals[level] += totalByScholar.get(s.scholarId) ?? 0;
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
      university: s.university,
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

  const activeIds = scholars
    .filter((s) => s.programStatus === ProgramStatus.ACTIVE)
    .map((s) => s.scholarId);
  const participatingActive = activeIds.filter((id) => (totalByScholar.get(id) ?? 0) > 3).length;

  return {
    participationRate: activeIds.length ? round2(participatingActive / activeIds.length) : 0,
    byActivityType: [...byType.entries()]
      .map(([activityType, totalActivities]) => ({ activityType, totalActivities }))
      .sort((a, b) => b.totalActivities - a.totalActivities),
    byMonth: [...byMonth.entries()]
      .map(([period, totalActivities]) => ({ period, totalActivities }))
      .sort((a, b) => a.period.localeCompare(b.period)),
    byRiskLevel: Object.values(RiskLevel).map((riskLevel) => ({
      riskLevel,
      scholarCount: perLevelCounts[riskLevel],
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
