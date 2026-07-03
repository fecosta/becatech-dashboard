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
  computeGlobalRiskValue,
  computeRiskChange,
  riskChangeLabel,
  riskLevelFromValue,
} from "./risk";

const uniq = (a: string[]): string[] => [...new Set(a)];

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
  let count = 0;

  for (const scholarId of uniq(scholarIds)) {
    const scholar = await prisma.scholar.findUnique({
      where: { scholarId },
      select: { country: true, cohort: true, university: true },
    });
    if (!scholar) continue;

    const latestTerm = await prisma.academicTerm.findFirst({
      where: { scholarId },
      orderBy: { term: "desc" },
      select: { gpa: true, failedSubjectsCount: true, expectedProgressStatus: true },
    });
    const academic = deriveAcademicRiskValue({
      gpa: latestTerm?.gpa ?? null,
      failedSubjectsCount: latestTerm?.failedSubjectsCount ?? null,
      expectedProgressStatus: latestTerm?.expectedProgressStatus ?? null,
    });

    let periods: string[] = [];
    if (batchPeriods.length > 0) {
      const [checkins, mentors, supports] = await Promise.all([
        prisma.monthlyCheckin.findMany({
          where: { scholarId, reportingMonth: { in: batchPeriods } },
          select: { reportingMonth: true },
        }),
        prisma.mentorReport.findMany({
          where: { scholarId, reportingMonth: { in: batchPeriods } },
          select: { reportingMonth: true },
        }),
        prisma.supportActivity.findMany({
          where: { scholarId, period: { in: batchPeriods } },
          select: { period: true },
        }),
      ]);
      const set = new Set<string>();
      for (const x of checkins) if (x.reportingMonth) set.add(x.reportingMonth);
      for (const x of mentors) if (x.reportingMonth) set.add(x.reportingMonth);
      for (const x of supports) set.add(x.period);
      periods = [...set];
    }
    if (periods.length === 0) {
      const latest = await prisma.riskAssessment.findFirst({
        where: { scholarId },
        orderBy: { period: "desc" },
        select: { period: true },
      });
      if (!latest) continue;
      periods = [latest.period];
    }
    periods.sort();

    for (const period of periods) {
      const [checkin, mentor, agg] = await Promise.all([
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
        prisma.supportActivity.aggregate({
          where: { scholarId, period },
          _sum: { activityCount: true },
        }),
      ]);

      const psychosocial = derivePsychosocialRiskValue({
        checkinFinalStatus: checkin?.finalStatus,
        mentorPermanenceRisk: mentor?.permanenceRisk,
        mentorPsychosocialStatus: mentor?.psychosocialStatus,
      });
      const participation = deriveParticipationRiskValue(agg._sum.activityCount ?? 0);
      const global = computeGlobalRiskValue(academic, psychosocial, participation);

      const prev = await prisma.riskAssessment.findFirst({
        where: { scholarId, period: { lt: period } },
        orderBy: { period: "desc" },
        select: { globalRiskValue: true },
      });
      const previousGlobal = prev?.globalRiskValue ?? null;
      const change = computeRiskChange(global, previousGlobal);

      const fields = {
        academicRiskValue: academic,
        academicRiskLevel: riskLevelFromValue(academic),
        psychosocialRiskValue: psychosocial,
        psychosocialRiskLevel: riskLevelFromValue(psychosocial),
        participationRiskValue: participation,
        participationRiskLevel: riskLevelFromValue(participation),
        globalRiskValue: global,
        globalRiskLevel: riskLevelFromValue(global),
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
          university: scholar.university,
          ...fields,
        },
      });
      count += 1;
    }
  }

  return count;
}
