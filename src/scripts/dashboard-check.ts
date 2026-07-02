// Dev tool: run every dashboard query against the seeded data and print a summary.
// Usage: npm run dashboard:check
import "dotenv/config";
import {
  getAcademicProgress,
  getExecutiveOverview,
  getRiskAlerts,
  getScholarProfile,
  getSupportParticipation,
  getUnitEconomics,
} from "../lib/dashboard/queries";
import { prisma } from "../lib/db";

async function main() {
  const exec = await getExecutiveOverview();
  console.log("=== Executive overview ===");
  console.dir(exec, { depth: null });

  const risk = await getRiskAlerts();
  console.log("\n=== Risk & alerts ===");
  console.log("distribution:", risk.distribution);
  console.log("attention list size:", risk.attentionList.length);
  console.log(
    "top 3:",
    risk.attentionList.slice(0, 3).map((r) => ({
      scholarId: r.scholarId,
      level: r.globalRiskLevel,
      alert: r.alertType,
      change: r.riskChangeLabel,
      missingCheckin: r.missingCheckin,
      missingMentor: r.missingMentorReport,
    })),
  );

  const acad = await getAcademicProgress();
  console.log("\n=== Academic progress ===");
  console.log("averageGpa:", acad.averageGpa);
  console.log("gpaByCountry:", acad.gpaByCountry);
  console.log("progressStatusDistribution:", acad.progressStatusDistribution);
  console.log("academicRiskDistribution:", acad.academicRiskDistribution);
  console.log("scholarsBehind:", acad.scholarsBehind.length, "withFailedSubjects:", acad.scholarsWithFailedSubjects);

  const part = await getSupportParticipation();
  console.log("\n=== Support participation ===");
  console.log("participationRate:", part.participationRate);
  console.log("byActivityType:", part.byActivityType);
  console.log("byMonth:", part.byMonth);
  console.log("byRiskLevel:", part.byRiskLevel);
  console.log("lowParticipationScholars:", part.lowParticipationScholars.length);
  console.log("highRiskSupport:", part.highRiskSupport);

  const econ = await getUnitEconomics();
  console.log("\n=== Unit economics ===");
  console.dir(econ, { depth: null });

  const first = await prisma.scholar.findFirst({ orderBy: { scholarId: "asc" } });
  const profile = first ? await getScholarProfile(first.scholarId) : null;
  console.log("\n=== Scholar profile sample:", first?.scholarId, "===");
  if (profile) {
    console.log({
      fullName: profile.fullName,
      terms: profile.academicTerms.length,
      riskAssessments: profile.riskAssessments.length,
      checkins: profile.checkins.length,
      mentorReports: profile.mentorReports.length,
      supportActivities: profile.supportActivities.length,
      requests: profile.requests.length,
      financialInputs: profile.financialInputs.length,
      gpaTrend: profile.gpaTrend,
    });
  }

  const colombia = await getExecutiveOverview({ country: "COLOMBIA" });
  console.log("\n=== Executive overview (filter: Colombia) ===");
  console.log({ total: colombia.totalScholars, active: colombia.activeScholars, avgGpa: colombia.averageGpa });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
