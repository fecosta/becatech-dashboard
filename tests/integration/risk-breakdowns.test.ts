import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { getRiskBreakdowns } from "@/lib/dashboard/queries";
import { prisma } from "@/lib/db";
import type { RiskLevel } from "@/generated/prisma/enums";
import { resetDb, seedFixture } from "./helpers";

// seedFixture()'s BT-CO-001 is Female with no risk row / socioeconomic / municipality, so it only
// lands in the "Women" gender group — the assertions below target Men/Baja/Medellín to isolate the
// scholars this test creates.
beforeEach(async () => {
  await resetDb();
  await seedFixture();
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

async function scholarWithRisk(o: {
  id: string;
  gender: string;
  socioeconomicLevel: string;
  municipality: string;
  level: RiskLevel;
}) {
  const uni = await prisma.university.findFirstOrThrow();
  await prisma.scholar.create({
    data: {
      scholarId: o.id,
      fullName: o.id,
      country: "COLOMBIA",
      cohort: "2025",
      universityId: uni.id,
      academicProgram: "CS",
      gender: o.gender,
      programStatus: "ACTIVE",
      socioeconomicLevel: o.socioeconomicLevel,
      currentMunicipality: o.municipality,
    },
  });
  await prisma.riskAssessment.create({
    data: {
      scholarId: o.id,
      period: "2026-03",
      globalRiskLevel: o.level,
      globalRiskValue: RISK_VALUE[o.level],
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

describe("getRiskBreakdowns (Early Support: by city / gender / socioeconomic)", () => {
  it("computes low-risk % per group (SIN+BAJO over the eligible group count)", async () => {
    // Two men, both Baja, both Medellín: one low-risk (SIN_RIESGO), one high (CRITICO) → 50%.
    await scholarWithRisk({ id: "M-1", gender: "Male", socioeconomicLevel: "Baja", municipality: "Medellín", level: "SIN_RIESGO" });
    await scholarWithRisk({ id: "M-2", gender: "Male", socioeconomicLevel: "Baja", municipality: "Medellín", level: "CRITICO" });

    const b = await getRiskBreakdowns();

    expect(b.byGender.find((r) => r.name === "Men")).toMatchObject({ scholarCount: 2, lowRiskPct: 0.5 });
    expect(b.bySocioeconomic.find((r) => r.name === "Baja")).toMatchObject({ scholarCount: 2, lowRiskPct: 0.5 });
    expect(b.byCity.find((r) => r.name === "Medellín")).toMatchObject({ scholarCount: 2, lowRiskPct: 0.5 });
  });
});
