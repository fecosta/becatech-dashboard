// Recompute RiskAssessment rows from underlying data after an import commit.
// Academic risk uses the scholar's latest term (a documented proxy for current standing);
// psychosocial and participation use the specific month's check-in/mentor/support data.
import { prisma } from "../db";
import {
  deriveAcademicRiskValue,
  deriveParticipationRiskValue,
  derivePsychosocialRiskValue,
} from "./derive";
import {
  computeAlertType,
  computeAssessmentCompleteness,
  computeGlobalRiskValue,
  computeRiskChange,
  riskChangeLabel,
  riskLevelFromValue,
} from "./risk";

const uniq = (a: string[]): string[] => [...new Set(a)];

// Each scholar's recompute is fully independent of every other scholar's (no shared state, and
// this runs against the plain `prisma` client, not a held transaction, so genuinely concurrent
// connections are safe) — a Google-Sheets-sync batch can touch hundreds of scholars, and doing
// them one at a time was slow enough to hit Vercel's function timeout on large syncs
// (SUPPORT_ACTIVITY: ~236 scholars x up to 6 periods each). Bounded so we don't try to open more
// simultaneous connections than the pool comfortably supports.
const CONCURRENCY = 15;

/**
 * Recompute risk for the given scholars. Periods to (re)compute:
 *  - months among `batchPeriods` where the scholar now has a check-in/mentor/support row;
 *  - if none (e.g. an academic-terms-only import), the scholar's most recent existing period.
 * Returns the number of RiskAssessment rows written.
 */
export async function recomputeRiskForScholars(
  scholarIds: string[],
  batchPeriods: string[] = [],
): Promise<number> {
  const ids = uniq(scholarIds);
  let count = 0;
  for (let i = 0; i < ids.length; i += CONCURRENCY) {
    const chunk = ids.slice(i, i + CONCURRENCY);
    const results = await Promise.all(chunk.map((scholarId) => recomputeOneScholar(scholarId, batchPeriods)));
    for (const n of results) count += n;
  }
  return count;
}

async function recomputeOneScholar(scholarId: string, batchPeriods: string[]): Promise<number> {
  let count = 0;
  {
    const scholar = await prisma.scholar.findUnique({
      where: { scholarId },
      select: { country: true, cohort: true, university: { select: { name: true } } },
    });
    if (!scholar) return count;

    const latestTerm = await prisma.academicTerm.findFirst({
      where: { scholarId },
      orderBy: { term: "desc" },
      select: { gpa: true, failedSubjectsCount: true, expectedProgressStatus: true },
    });
    const academic = deriveAcademicRiskValue({
      gpa: latestTerm?.gpa ?? null,
      failedSubjectsCount: latestTerm?.failedSubjectsCount ?? null,
      expectedProgressStatus: latestTerm?.expectedProgressStatus ?? null,
      country: scholar.country,
    });

    let periods: string[] = [];
    if (batchPeriods.length > 0) {
      // Risk periods are real reporting months (YYYY-MM) sourced from monthly check-ins and mentor
      // reports. The deprecated SUPPORT ACTIVITY LOG is intentionally NOT a period source — its
      // `MES` date cells produced timestamp-shaped periods that corrupted the current-period logic.
      const [checkins, mentors] = await Promise.all([
        prisma.monthlyCheckin.findMany({
          where: { scholarId, reportingMonth: { in: batchPeriods } },
          select: { reportingMonth: true },
        }),
        prisma.mentorReport.findMany({
          where: { scholarId, reportingMonth: { in: batchPeriods } },
          select: { reportingMonth: true },
        }),
      ]);
      const set = new Set<string>();
      for (const x of checkins) if (x.reportingMonth) set.add(x.reportingMonth);
      for (const x of mentors) if (x.reportingMonth) set.add(x.reportingMonth);
      periods = [...set];
    }
    if (periods.length === 0) {
      // Fall back to the scholar's most recent *real* month. We must not pick a plain max(period):
      // legacy junk periods ("MES 7") sort lexically above a real month ("2026-08"), so a naive max
      // would resurrect a corrupted period. Filter to YYYY-MM and take the latest (fixed-width, so
      // lexical sort == chronological). No real month yet ⇒ nothing to recompute.
      const existing = await prisma.riskAssessment.findMany({
        where: { scholarId },
        select: { period: true },
        distinct: ["period"],
      });
      const months = existing.map((r) => r.period).filter((p) => /^\d{4}-\d{2}$/.test(p));
      if (months.length === 0) return count;
      months.sort();
      periods = [months[months.length - 1]];
    }
    periods.sort();

    for (const period of periods) {
      const [checkin, mentor, activityAgg] = await Promise.all([
        prisma.monthlyCheckin.findFirst({
          where: { scholarId, reportingMonth: period },
          orderBy: { submissionDate: "desc" },
          select: { finalStatus: true },
        }),
        prisma.mentorReport.findFirst({
          where: { scholarId, reportingMonth: period },
          orderBy: { sessionDate: "desc" },
          select: { permanenceRisk: true, psychosocialStatus: true },
        }),
        // Participation now comes from the mentor reports' activity counts (the current data
        // source) — the standalone SUPPORT ACTIVITY LOG is deprecated. _count distinguishes "no
        // mentor report for this period" (missing data → participation not assessed → null, never
        // inflated to CRITICO) from "a report exists with zero logged activities" (a real 0 → 4).
        prisma.mentorReport.aggregate({
          where: { scholarId, reportingMonth: period },
          _sum: {
            individualTutoring: true,
            groupTutoring: true,
            individualMentoring: true,
            groupMentoring: true,
            workshops: true,
          },
          _count: { _all: true },
        }),
      ]);

      const psychosocial = derivePsychosocialRiskValue({
        checkinFinalStatus: checkin?.finalStatus,
        mentorPermanenceRisk: mentor?.permanenceRisk,
        mentorPsychosocialStatus: mentor?.psychosocialStatus,
      });
      const a = activityAgg._sum;
      const totalActivities =
        (a.individualTutoring ?? 0) +
        (a.groupTutoring ?? 0) +
        (a.individualMentoring ?? 0) +
        (a.groupMentoring ?? 0) +
        (a.workshops ?? 0);
      const participation = deriveParticipationRiskValue(
        activityAgg._count._all > 0 ? totalActivities : null,
      );
      const global = computeGlobalRiskValue(academic, psychosocial, participation);
      const { assessmentComplete, missingInputs } = computeAssessmentCompleteness(
        academic,
        psychosocial,
        participation,
      );

      const prev = await prisma.riskAssessment.findFirst({
        where: { scholarId, period: { lt: period } },
        orderBy: { period: "desc" },
        select: { globalRiskValue: true },
      });
      const previousGlobal = prev?.globalRiskValue ?? null;
      const change = computeRiskChange(global, previousGlobal);

      // A not-assessed (null) dimension is stored as 0 (it contributed nothing to the global max)
      // and named in missingInputs — never inflated to a risk band. See computeGlobalRiskValue.
      const fields = {
        academicRiskValue: academic ?? 0,
        academicRiskLevel: riskLevelFromValue(academic ?? 0),
        psychosocialRiskValue: psychosocial ?? 0,
        psychosocialRiskLevel: riskLevelFromValue(psychosocial ?? 0),
        participationRiskValue: participation ?? 0,
        participationRiskLevel: riskLevelFromValue(participation ?? 0),
        globalRiskValue: global,
        globalRiskLevel: riskLevelFromValue(global),
        assessmentComplete,
        missingInputs,
        previousGlobalRiskValue: previousGlobal,
        riskChange: change,
        riskChangeLabel: riskChangeLabel(change),
        alertType: computeAlertType(academic, psychosocial, participation),
        source: "import-recompute",
      };

      await prisma.riskAssessment.upsert({
        where: { scholarId_period: { scholarId, period } },
        update: fields,
        create: {
          scholarId,
          period,
          country: scholar.country,
          cohort: scholar.cohort,
          university: scholar.university.name,
          ...fields,
        },
      });
      count += 1;
    }
  }

  return count;
}
