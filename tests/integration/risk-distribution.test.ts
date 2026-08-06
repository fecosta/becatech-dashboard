import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { getExecutiveOverview, getHomeOverview, getRiskStageSummary } from "@/lib/dashboard/queries";
import { prisma } from "@/lib/db";
import type { RiskLevel } from "@/generated/prisma/enums";
import { resetDb, seedFixture } from "./helpers";

beforeEach(async () => {
  await resetDb();
  await seedFixture(); // BT-CO-001: ACTIVE, cohort "2025" (eligible), university "UNAL"
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

async function addScholar(id: string, cohort: string, programStatus: "ACTIVE" | "WITHDRAWN") {
  const uni = await prisma.university.findFirstOrThrow();
  await prisma.scholar.create({
    data: {
      scholarId: id,
      fullName: id,
      country: "COLOMBIA",
      cohort,
      universityId: uni.id,
      academicProgram: "CS",
      gender: "Female",
      programStatus,
    },
  });
}

async function addRisk(scholarId: string, period: string, level: RiskLevel) {
  await prisma.riskAssessment.create({
    data: {
      scholarId,
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

describe("risk distribution (MES period + active-≠Cohorte-2024 denominator)", () => {
  it("uses the latest MES and counts only active, non-2024 scholars", async () => {
    await addScholar("BT-CO-2024", "Cohorte 2024 COL", "ACTIVE"); // excluded: Cohorte 2024
    await addScholar("BT-CO-W", "2025", "WITHDRAWN"); // excluded: not active

    await addRisk("BT-CO-001", "MES 1", "SIN_RIESGO");
    await addRisk("BT-CO-001", "MES 2", "RIESGO_ALTO"); // MES 2 is the latest → current period
    await addRisk("BT-CO-2024", "MES 2", "CRITICO"); // must NOT count (Cohorte 2024)
    await addRisk("BT-CO-W", "MES 2", "CRITICO"); // must NOT count (withdrawn)

    const summary = await getRiskStageSummary({});
    expect(summary.currentPeriod).toBe("MES 2"); // latest by number, not lexical
    expect(summary.assessedScholarCount).toBe(1); // only BT-CO-001 is active + non-2024
    expect(summary.distribution.RIESGO_ALTO).toBe(1); // BT-CO-001's MES 2 classification
    expect(summary.distribution.CRITICO).toBe(0); // excluded scholars don't leak in
    expect(summary.criticalHighCount).toBe(1); // High + Critical = the one RIESGO_ALTO
  });

  it("carries each scholar's most recent classification forward to a later current period", async () => {
    // BT-CO-001 has a MES 1 classification but no MES 2 → at MES 2 its latest (MES 1) still counts.
    await addRisk("BT-CO-001", "MES 1", "RIESGO_ALTO");
    await addScholar("BT-CO-003", "2025", "ACTIVE");
    await addRisk("BT-CO-003", "MES 2", "SIN_RIESGO"); // makes MES 2 the current period

    const summary = await getRiskStageSummary({});
    expect(summary.currentPeriod).toBe("MES 2");
    expect(summary.assessedScholarCount).toBe(2); // both active non-2024
    expect(summary.distribution.SIN_RIESGO).toBe(1); // BT-CO-003 at MES 2
    expect(summary.distribution.RIESGO_ALTO).toBe(1); // BT-CO-001's MES 1 carried forward
  });
});

describe("retention + women% reconciled to the sheet", () => {
  it("retention = ACTIVE ÷ known-status (excl. 2024); women% = active women ÷ all women (2025/26)", async () => {
    // seedFixture: BT-CO-001 = ACTIVE, cohort 2025, Female.
    await addScholar("BT-CO-W", "2025", "WITHDRAWN"); // Female, eligible denominator, not active
    await addScholar("BT-CO-2024", "Cohorte 2024 COL", "ACTIVE"); // excluded from both metrics

    const exec = await getExecutiveOverview({});
    // ≠2024 scholars: BT-CO-001 (active) + BT-CO-W (withdrawn) = 2; active = 1 → 0.5
    expect(exec.retentionRate).toBe(0.5);

    const home = await getHomeOverview({});
    // women ≠2024: BT-CO-001 + BT-CO-W = 2; active women = 1 → 0.5
    expect(home.womenPercentage).toBe(0.5);
  });
});
