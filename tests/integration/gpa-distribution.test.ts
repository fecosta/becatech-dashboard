import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { getAcademicProgress, getExecutiveOverview, getScholarDirectory } from "@/lib/dashboard/queries";
import { prisma } from "@/lib/db";
import { resetDb, seedFixture } from "./helpers";

// SPEC-004 §10. These tests are deliberately PRODUCTION-shaped: every AcademicTerm below sets
// `gpa` and leaves `accumulatedGpa` null, which is exactly what the Google Sheets sync writes.
// The seeded demo data populates both columns, so a suite built on the seed cannot catch the
// defect this phase fixes — the distribution reading the column production never fills.
beforeEach(async () => {
  await resetDb();
  await seedFixture();
  // seedFixture()'s BT-CO-001 has no academic terms; drop it so each test owns its population.
  await prisma.scholar.delete({ where: { scholarId: "BT-CO-001" } });
});
afterAll(async () => {
  await prisma.$disconnect();
});

async function universityFor(country: "COLOMBIA" | "PERU") {
  const name = country === "COLOMBIA" ? "UNAL" : "UNMSM";
  const existing = await prisma.university.findFirst({ where: { name } });
  if (existing) return existing;
  return prisma.university.create({
    data: { name, country, city: country === "COLOMBIA" ? "Bogotá" : "Lima", type: "PUBLIC" },
  });
}

/** A scholar plus their graded terms, written the way the production sync writes them. */
async function makeScholar(o: {
  id: string;
  country?: "COLOMBIA" | "PERU";
  cohort?: string;
  currentSemester?: number;
  /** [term, gpa] pairs. `accumulatedGpa` is intentionally never set. */
  terms?: [string, number | null][];
}) {
  const country = o.country ?? "COLOMBIA";
  const university = await universityFor(country);
  await prisma.scholar.create({
    data: {
      scholarId: o.id,
      fullName: o.id,
      country,
      cohort: o.cohort ?? "2025",
      universityId: university.id,
      academicProgram: "CS",
      gender: "Female",
      programStatus: "ACTIVE",
      currentSemester: o.currentSemester ?? 2,
    },
  });
  for (const [term, gpa] of o.terms ?? []) {
    await prisma.academicTerm.create({
      data: { scholarId: o.id, term, gpa, accumulatedGpa: null },
    });
  }
}

const bucketed = (d: { below3_5: number; from3_5To3_9: number; from4_0To5_0: number }) =>
  d.below3_5 + d.from3_5To3_9 + d.from4_0To5_0;

describe("GPA distribution — production-shaped source data", () => {
  it("buckets scholars from AcademicTerm.gpa while accumulatedGpa is null", async () => {
    await makeScholar({ id: "S-1", terms: [["2025-1", 3.2]] });
    await makeScholar({ id: "S-2", terms: [["2025-1", 4.4]] });

    const terms = await prisma.academicTerm.findMany({ select: { accumulatedGpa: true } });
    expect(terms.every((t) => t.accumulatedGpa === null)).toBe(true);

    const { gpaDistribution } = await getAcademicProgress();
    expect(gpaDistribution.below3_5).toBe(1);
    expect(gpaDistribution.from4_0To5_0).toBe(1);
    expect(gpaDistribution.excludedNoGradedGpa).toBe(0);
  });

  it("places each bucket boundary on the documented side", async () => {
    await makeScholar({ id: "B-349", terms: [["2025-1", 3.49]] });
    await makeScholar({ id: "B-350", terms: [["2025-1", 3.5]] });
    await makeScholar({ id: "B-399", terms: [["2025-1", 3.99]] });
    await makeScholar({ id: "B-400", terms: [["2025-1", 4.0]] });
    await makeScholar({ id: "B-500", terms: [["2025-1", 5.0]] });

    const { gpaDistribution: d } = await getAcademicProgress();
    expect(d.below3_5).toBe(1); // 3.49
    expect(d.from3_5To3_9).toBe(2); // 3.5, 3.99
    expect(d.from4_0To5_0).toBe(2); // 4.0, 5.0
    expect(d.excludedNoGradedGpa).toBe(0);
  });

  it("treats GPA 0 as not graded, never as a failing grade", async () => {
    await makeScholar({ id: "Z-1", terms: [["2025-1", 0]] });

    const { gpaDistribution: d } = await getAcademicProgress();
    expect(d.below3_5).toBe(0);
    expect(bucketed(d)).toBe(0);
    expect(d.excludedNoGradedGpa).toBe(1);
  });

  it("excludes null, negative, and above-scale GPA", async () => {
    await makeScholar({ id: "N-null", terms: [["2025-1", null]] });
    await makeScholar({ id: "N-neg", terms: [["2025-1", -1]] });
    await makeScholar({ id: "N-over", terms: [["2025-1", 6.2]] });
    await makeScholar({ id: "N-none" }); // no academic term at all

    const { gpaDistribution: d } = await getAcademicProgress();
    expect(bucketed(d)).toBe(0);
    expect(d.excludedNoGradedGpa).toBe(4);
  });

  it("does not let a later ungraded term mask the latest real grade", async () => {
    await makeScholar({
      id: "F-1",
      terms: [
        ["2024-2", 3.1],
        ["2025-1", 4.6], // the scholar's actual latest grade
        ["2025-2", 0], // not enrolled
        ["2026-1", null], // future, not graded
      ],
    });

    const { gpaDistribution: d } = await getAcademicProgress();
    expect(d.from4_0To5_0).toBe(1);
    expect(bucketed(d)).toBe(1);
    expect(d.excludedNoGradedGpa).toBe(0);
  });

  it("keeps Peru scholars out of Colombia's buckets and counts them separately", async () => {
    await makeScholar({ id: "P-1", country: "PERU", terms: [["2025-1", 17.5]] });
    await makeScholar({ id: "P-2", country: "PERU", terms: [["2025-1", 4.2]] }); // valid on /20 too
    await makeScholar({ id: "C-1", terms: [["2025-1", 4.2]] });

    const { gpaDistribution: d } = await getAcademicProgress();
    expect(bucketed(d)).toBe(1); // only the Colombia scholar
    expect(d.from4_0To5_0).toBe(1);
    expect(d.excludedOtherScale).toBe(2);
    expect(d.excludedNoGradedGpa).toBe(0);
  });

  it("reconciles buckets + excluded with the whole population in scope", async () => {
    await makeScholar({ id: "R-1", terms: [["2025-1", 2.8]] });
    await makeScholar({ id: "R-2", terms: [["2025-1", 3.7]] });
    await makeScholar({ id: "R-3", terms: [["2025-1", 0]] });
    await makeScholar({ id: "R-4" });
    await makeScholar({ id: "R-5", country: "PERU", terms: [["2025-1", 15]] });

    const { gpaDistribution: d } = await getAcademicProgress();
    const scope = await prisma.scholar.count();
    expect(bucketed(d) + d.excludedNoGradedGpa + d.excludedOtherScale).toBe(scope);
    expect(scope).toBe(5);
  });

  it("respects the page's cohort, country, and program-stage filters", async () => {
    await makeScholar({ id: "F-A", cohort: "2024", terms: [["2025-1", 2.0]] });
    await makeScholar({ id: "F-B", cohort: "2025", terms: [["2025-1", 4.5]] });
    await makeScholar({ id: "F-C", cohort: "2025", currentSemester: 7, terms: [["2025-1", 4.5]] });

    const byCohort = await getAcademicProgress({ cohort: "2025" });
    expect(bucketed(byCohort.gpaDistribution)).toBe(2);
    expect(byCohort.gpaDistribution.below3_5).toBe(0);

    // Early Support's own scope: Years 1–2 only, which drops the semester-7 scholar.
    const earlySupport = await getAcademicProgress({ cohort: "2025", programStage: "YEARS_1_2" });
    expect(bucketed(earlySupport.gpaDistribution)).toBe(1);

    const byCountry = await getAcademicProgress({ country: "PERU" });
    expect(bucketed(byCountry.gpaDistribution)).toBe(0);
  });
});

describe("GPA summary KPI — production-shaped source data", () => {
  it("stays country-aware on a mixed scope and never blends the scales", async () => {
    await makeScholar({ id: "M-CO", terms: [["2025-1", 4.0]] });
    await makeScholar({ id: "M-PE", country: "PERU", terms: [["2025-1", 16.0]] });

    const { gpaSummary } = await getAcademicProgress();
    expect(gpaSummary.colombia).toMatchObject({ average: 4.0, scale: 5, count: 1 });
    expect(gpaSummary.peru).toMatchObject({ average: 16.0, scale: 20, count: 1 });
    // 4/5 and 16/20 are both 80% of their own scale.
    expect(gpaSummary.normalizedOverallPercentage).toBe(80);
  });

  it("is populated from AcademicTerm.gpa, not the unpopulated accumulatedGpa", async () => {
    await makeScholar({ id: "K-1", terms: [["2025-1", 3.6]] });

    const { gpaSummary } = await getAcademicProgress();
    expect(gpaSummary.colombia.count).toBe(1);
    expect(gpaSummary.colombia.average).toBe(3.6);
  });

  it("excludes ungraded terms from the average instead of averaging in a 0", async () => {
    await makeScholar({ id: "K-2", terms: [["2025-1", 4.0], ["2025-2", 0]] });

    const { gpaSummary } = await getAcademicProgress();
    expect(gpaSummary.colombia.average).toBe(4.0);
  });
});

describe("other latest-GPA consumers read the same column", () => {
  it("getExecutiveOverview summarizes from AcademicTerm.gpa", async () => {
    await makeScholar({ id: "E-1", terms: [["2025-1", 3.0]] });
    await makeScholar({ id: "E-2", terms: [["2025-1", 5.0]] });

    const { gpaSummary } = await getExecutiveOverview();
    expect(gpaSummary.colombia.count).toBe(2);
    expect(gpaSummary.colombia.average).toBe(4.0);
  });

  it("the scholar directory's latestGpa is the latest graded term", async () => {
    await makeScholar({ id: "L-1", terms: [["2025-1", 3.8], ["2025-2", 0]] });
    await makeScholar({ id: "L-2", terms: [["2025-1", 0]] });

    const list = await getScholarDirectory();
    expect(list.find((r) => r.scholarId === "L-1")?.latestGpa).toBe(3.8);
    expect(list.find((r) => r.scholarId === "L-2")?.latestGpa).toBeNull();
  });
});
