import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { getHomeOverview } from "@/lib/dashboard/queries";
import { prisma } from "@/lib/db";
import { resetDb, seedFixture } from "./helpers";

// seedFixture() creates BT-CO-001: ACTIVE, cohort "2025", university "UNAL", no socioeconomic/
// municipality/English fields — so it lands in the "Not reported" socioeconomic bucket, contributes
// nothing to the city/English aggregates, and is the sole active row for UNAL.
beforeEach(async () => {
  await resetDb();
  await seedFixture();
});
afterAll(async () => {
  await prisma.$disconnect();
});

async function makeScholar(o: {
  id: string;
  universityId: string;
  country?: "COLOMBIA" | "PERU";
  programStatus?: "ACTIVE" | "WITHDRAWN";
  socioeconomicLevel?: string | null;
  currentMunicipality?: string | null;
  currentEnglishLevel?: string | null;
}) {
  await prisma.scholar.create({
    data: {
      scholarId: o.id,
      fullName: o.id,
      country: o.country ?? "COLOMBIA",
      cohort: "2025",
      universityId: o.universityId,
      academicProgram: "CS",
      gender: "Female",
      programStatus: o.programStatus ?? "ACTIVE",
      socioeconomicLevel: o.socioeconomicLevel ?? null,
      currentMunicipality: o.currentMunicipality ?? null,
      currentEnglishLevel: o.currentEnglishLevel ?? null,
    },
  });
}

describe("getHomeOverview new aggregates (JULY 2 redesign)", () => {
  it("aggregates socioeconomic, city, English, and per-university retention", async () => {
    const uni = await prisma.university.create({
      data: { name: "Universidad Test", country: "COLOMBIA", city: "Medellín", type: "PRIVATE" },
    });
    await makeScholar({ id: "S-1", universityId: uni.id, socioeconomicLevel: "Baja", currentMunicipality: "Medellín", currentEnglishLevel: "B2" });
    await makeScholar({ id: "S-2", universityId: uni.id, socioeconomicLevel: "Baja", currentMunicipality: "Medellín", currentEnglishLevel: "B2 - Upper Intermediate" });
    await makeScholar({ id: "S-3", universityId: uni.id, socioeconomicLevel: "Alta", currentMunicipality: "Bogotá", currentEnglishLevel: "A1" });
    await makeScholar({ id: "S-4", universityId: uni.id, programStatus: "WITHDRAWN", currentMunicipality: "Medellín" });
    // A Peru scholar is active + English-classified, but must NOT appear in the Colombia city list.
    await makeScholar({ id: "S-PE", universityId: uni.id, country: "PERU", currentMunicipality: "Lima", currentEnglishLevel: "C1" });

    const home = await getHomeOverview();

    // Socioeconomic (active only): Baja 2, Alta 1; Baja ordered before Alta.
    const baja = home.socioeconomicBreakdown.find((s) => s.level === "Baja");
    const alta = home.socioeconomicBreakdown.find((s) => s.level === "Alta");
    expect(baja?.count).toBe(2);
    expect(alta?.count).toBe(1);
    expect(home.socioeconomicBreakdown.findIndex((s) => s.level === "Baja")).toBeLessThan(
      home.socioeconomicBreakdown.findIndex((s) => s.level === "Alta"),
    );

    // City (active Colombia only): Medellín 2 (S-4 withdrawn excluded, S-PE Peru excluded); no Lima.
    expect(home.cityBreakdown.find((c) => c.city === "Medellín")?.count).toBe(2);
    expect(home.cityBreakdown.some((c) => c.city === "Lima")).toBe(false);

    // English canonicalization: "B2 - Upper Intermediate" -> B2 (so B2 = 2), A1 = 1, C1 = 1.
    expect(home.englishLevelDistribution).not.toBeNull();
    const byLevel = Object.fromEntries(
      (home.englishLevelDistribution ?? []).map((e) => [e.level, e.count]),
    );
    expect(byLevel.B2).toBe(2);
    expect(byLevel.A1).toBe(1);
    expect(byLevel.C1).toBe(1);

    // Retention for "Universidad Test": 4 active + 1 withdrawn = 80% / 20%.
    const uniRow = home.universityRetention.find((u) => u.name === "Universidad Test");
    expect(uniRow?.activeCount).toBe(4);
    expect(uniRow?.dropOutCount).toBe(1);
    expect(uniRow?.retentionPct).toBe(80);
    expect(uniRow?.dropOutPct).toBe(20);
  });

  it("returns null englishLevelDistribution when no levels are recorded", async () => {
    const home = await getHomeOverview();
    expect(home.englishLevelDistribution).toBeNull();
  });
});
