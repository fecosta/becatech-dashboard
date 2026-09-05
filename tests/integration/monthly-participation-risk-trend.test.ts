import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { getMonthlyParticipationRiskTrend } from "@/lib/dashboard/queries";
import { prisma } from "@/lib/db";
import type { RiskLevel } from "@/generated/prisma/enums";
import { resetDb, seedFixture } from "./helpers";

beforeEach(async () => {
  await resetDb();
  await seedFixture(); // BT-CO-001: ACTIVE, cohort "2025" (eligible), university "UNAL", COLOMBIA
});

afterAll(async () => {
  await prisma.$disconnect();
});

const RISK_VALUE: Record<RiskLevel, number> = {
  SIN_RIESGO: 0,
  RIESGO_BAJO: 1,
  RIESGO_MEDIO: 2,
  RIESGO_ALTO: 3,
  CRITICO: 4,
};

let submissionSeq = 0;

async function addScholar(
  id: string,
  overrides: { cohort?: string; country?: "COLOMBIA" | "PERU"; universityId?: string } = {},
) {
  const uni = overrides.universityId ?? (await prisma.university.findFirstOrThrow()).id;
  await prisma.scholar.create({
    data: {
      scholarId: id,
      fullName: id,
      country: overrides.country ?? "COLOMBIA",
      cohort: overrides.cohort ?? "2025",
      universityId: uni,
      academicProgram: "CS",
      gender: "Female",
      programStatus: "ACTIVE",
    },
  });
}

async function addRisk(scholarId: string, semester: string, period: string, level: RiskLevel) {
  await prisma.riskAssessment.create({
    data: {
      scholarId,
      semester,
      period,
      globalRiskLevel: level,
      globalRiskValue: RISK_VALUE[level],
      academicRiskLevel: "SIN_RIESGO",
      academicRiskValue: 0,
      psychosocialRiskLevel: "SIN_RIESGO",
      psychosocialRiskValue: 0,
      participationRiskLevel: "SIN_RIESGO",
      participationRiskValue: 0,
      source: "mentor-report",
    },
  });
}

/** activityTotal > 0 means "participated"; 0 (the default) means classified but not participating. */
async function addReport(scholarId: string, semester: string, reportingMonth: string, activityTotal = 0) {
  submissionSeq += 1;
  await prisma.mentorReport.create({
    data: {
      scholarId,
      semester,
      reportingMonth,
      submissionId: `mr-${submissionSeq}`,
      individualTutoring: activityTotal,
    },
  });
}

describe("getMonthlyParticipationRiskTrend", () => {
  it("returns all 6 program months in order, MES n → M-number", async () => {
    await addRisk("BT-CO-001", "2026-1", "MES 1", "RIESGO_MEDIO");
    await addReport("BT-CO-001", "2026-1", "MES 1", 2);

    const trend = await getMonthlyParticipationRiskTrend({ semester: "2026-1" });
    expect(trend.points.map((p) => p.programMonth)).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it("a month with no classified scholar at all is missing data, not a zero (null pct)", async () => {
    await addRisk("BT-CO-001", "2026-1", "MES 1", "RIESGO_ALTO");
    await addReport("BT-CO-001", "2026-1", "MES 1", 3);
    // MES 2..6: nothing seeded for this semester.

    const trend = await getMonthlyParticipationRiskTrend({ semester: "2026-1" });
    const [m1, m2] = trend.points;
    expect(m1.participationPct).not.toBeNull();
    expect(m1.mediumPlusRiskPct).not.toBeNull();
    expect(m2.riskDenominator).toBe(0);
    expect(m2.participationDenominator).toBe(0);
    expect(m2.participationPct).toBeNull();
    expect(m2.mediumPlusRiskPct).toBeNull();
  });

  it("a classified scholar with zero logged activity is a real 0%, not missing", async () => {
    await addRisk("BT-CO-001", "2026-1", "MES 2", "SIN_RIESGO");
    // No matching MentorReport row at all for MES 2 → classified, but nothing to count as
    // participation either way; the classified set itself still makes the denominator non-zero.
    await addReport("BT-CO-001", "2026-1", "MES 2", 0); // reported, but zero activities logged

    const trend = await getMonthlyParticipationRiskTrend({ semester: "2026-1" });
    const m2 = trend.points[1];
    expect(m2.riskDenominator).toBe(1);
    expect(m2.participationDenominator).toBe(1);
    expect(m2.participationCount).toBe(0);
    expect(m2.participationPct).toBe(0); // a real zero, never null
  });

  it("never combines the same program month across two different semesters", async () => {
    await addRisk("BT-CO-001", "2026-1", "MES 3", "RIESGO_ALTO"); // Medium+
    await addReport("BT-CO-001", "2026-1", "MES 3", 2);
    await addRisk("BT-CO-001", "2026-2", "MES 3", "SIN_RIESGO"); // not Medium+
    await addReport("BT-CO-001", "2026-2", "MES 3", 0);

    const trend1 = await getMonthlyParticipationRiskTrend({ semester: "2026-1" });
    const trend2 = await getMonthlyParticipationRiskTrend({ semester: "2026-2" });

    expect(trend1.points[2].mediumPlusRiskCount).toBe(1);
    expect(trend1.points[2].participationCount).toBe(1);
    expect(trend2.points[2].mediumPlusRiskCount).toBe(0);
    expect(trend2.points[2].participationCount).toBe(0);
    // Isolation: querying one semester never returns the other's row for the same scholar+month.
    expect(trend1.points[2].riskDenominator).toBe(1);
    expect(trend2.points[2].riskDenominator).toBe(1);
  });

  it("defaults to the latest semester with data when filters.semester is omitted", async () => {
    await addRisk("BT-CO-001", "2026-1", "MES 1", "SIN_RIESGO");
    await addReport("BT-CO-001", "2026-1", "MES 1", 1);
    await addRisk("BT-CO-001", "2026-2", "MES 1", "CRITICO");
    await addReport("BT-CO-001", "2026-2", "MES 1", 1);

    const trend = await getMonthlyParticipationRiskTrend({});
    expect(trend.semester).toBe("2026-2");
    expect(trend.points[0].mediumPlusRiskCount).toBe(1); // the 2026-2 CRITICO row, not 2026-1's
  });

  it("Medium+ counts RIESGO_MEDIO/ALTO/CRITICO only, never SIN_RIESGO/RIESGO_BAJO", async () => {
    const levels: RiskLevel[] = ["SIN_RIESGO", "RIESGO_BAJO", "RIESGO_MEDIO", "RIESGO_ALTO", "CRITICO"];
    for (const [i, level] of levels.entries()) {
      const id = `BT-CO-L${i}`;
      await addScholar(id);
      await addRisk(id, "2026-1", "MES 4", level);
      await addReport(id, "2026-1", "MES 4", 1);
    }

    const trend = await getMonthlyParticipationRiskTrend({ semester: "2026-1" });
    const m4 = trend.points[3];
    expect(m4.riskDenominator).toBe(5);
    expect(m4.mediumPlusRiskCount).toBe(3); // MEDIO + ALTO + CRITICO
    expect(m4.mediumPlusRiskPct).toBe(0.6);
  });

  it("filters the scholar population by country/cohort/university like every other risk query", async () => {
    await addScholar("BT-CO-PE", { country: "PERU", cohort: "2025" });
    await addRisk("BT-CO-001", "2026-1", "MES 1", "RIESGO_ALTO");
    await addReport("BT-CO-001", "2026-1", "MES 1", 1);
    await addRisk("BT-CO-PE", "2026-1", "MES 1", "SIN_RIESGO");
    await addReport("BT-CO-PE", "2026-1", "MES 1", 1);

    const colombiaOnly = await getMonthlyParticipationRiskTrend({ semester: "2026-1", country: "COLOMBIA" });
    expect(colombiaOnly.points[0].riskDenominator).toBe(1);
    expect(colombiaOnly.points[0].mediumPlusRiskCount).toBe(1);

    const both = await getMonthlyParticipationRiskTrend({ semester: "2026-1" });
    expect(both.points[0].riskDenominator).toBe(2);
  });

  it("computes exact percentage arithmetic over the classified-scholar denominator", async () => {
    await addScholar("BT-CO-002");
    await addScholar("BT-CO-003");
    await addRisk("BT-CO-001", "2026-1", "MES 5", "RIESGO_ALTO");
    await addReport("BT-CO-001", "2026-1", "MES 5", 2); // participated
    await addRisk("BT-CO-002", "2026-1", "MES 5", "SIN_RIESGO");
    await addReport("BT-CO-002", "2026-1", "MES 5", 0); // classified, no activity
    await addRisk("BT-CO-003", "2026-1", "MES 5", "RIESGO_BAJO");
    // BT-CO-003 has no MentorReport row at all this month — still classified (has a RiskAssessment
    // row), still counts in the denominator, just not toward participation.

    const trend = await getMonthlyParticipationRiskTrend({ semester: "2026-1" });
    const m5 = trend.points[4];
    expect(m5.riskDenominator).toBe(3);
    expect(m5.participationDenominator).toBe(3);
    expect(m5.participationCount).toBe(1);
    expect(m5.participationPct).toBe(0.33); // round2(1/3) — matches getMonthlyRiskTrend's convention
    expect(m5.mediumPlusRiskCount).toBe(1);
    expect(m5.mediumPlusRiskPct).toBe(0.33);
  });

  it("returns 6 null-pct points and no error when no risk-eligible scholar is in scope", async () => {
    await prisma.scholar.update({ where: { scholarId: "BT-CO-001" }, data: { programStatus: "WITHDRAWN" } });

    const trend = await getMonthlyParticipationRiskTrend({ semester: "2026-1" });
    expect(trend.points).toHaveLength(6);
    for (const p of trend.points) {
      expect(p.participationPct).toBeNull();
      expect(p.mediumPlusRiskPct).toBeNull();
    }
  });
});
