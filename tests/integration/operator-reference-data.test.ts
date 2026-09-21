import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { CANONICAL_OPERATORS, provisionOperators } from "@/lib/data-import/reference-data";
import { ingestAndCommit } from "@/lib/data-import/service";
import { loadValidationContext } from "@/lib/data-import/validation-context";
import { prisma } from "@/lib/db";
import { csvBuffer, resetDb, seedFixture } from "./helpers";

// Production had 236 scholars, 0 with an operatorId, and an EMPTY Operator table: nothing in the
// application ever writes that catalog, so every source label failed to resolve and scholars
// committed with operatorId null. These tests cover the provisioning that closes that gap and the
// source-driven recovery that follows it. resetDb() leaves Operator empty, which is precisely the
// production starting state.
let uploaderId: string;

beforeEach(async () => {
  await resetDb();
  ({ uploaderId } = await seedFixture());
});
afterAll(async () => {
  await prisma.$disconnect();
});

const catalog = () =>
  prisma.operator.findMany({
    select: { name: true, country: true, track: true },
    orderBy: { name: "asc" },
  });

/** The normalized SCHOLAR tab Apps Script POSTs to /api/sync/import (x-entity: SCHOLAR). */
const scholarCsv = (rows: [string, string, string][]) =>
  csvBuffer(
    "scholarId,fullName,country,cohort,university,operator,academicProgram,gender\n" +
      rows
        .map(([id, country, operator]) => {
          const university = country === "COLOMBIA" ? "UNAL" : "UNMSM";
          return `${id},Name ${id},${country},2025,${university},${operator},CS,Female`;
        })
        .join("\n") +
      "\n",
  );

const syncScholars = (rows: [string, string, string][]) =>
  ingestAndCommit({
    data: scholarCsv(rows),
    filename: "NORMALIZED_SCHOLAR.csv",
    sourceType: "TEMPLATE",
    entity: "SCHOLAR",
    uploadedById: uploaderId,
  });

describe("canonical Operator reference provisioning", () => {
  it("creates exactly the four canonical operators on an empty catalog", async () => {
    expect(await prisma.operator.count()).toBe(0);

    const result = await provisionOperators();
    expect(result.created).toHaveLength(4);
    expect(result.unchanged).toHaveLength(0);
    expect(result.conflicts).toHaveLength(0);

    expect(await catalog()).toEqual(
      [...CANONICAL_OPERATORS].sort((a, b) => a.name.localeCompare(b.name)),
    );
  });

  it("is idempotent — a second run creates nothing and changes nothing", async () => {
    await provisionOperators();
    const before = await prisma.operator.findMany({ orderBy: { name: "asc" } });

    const second = await provisionOperators();
    expect(second.created).toHaveLength(0);
    expect(second.unchanged).toHaveLength(4);
    expect(second.conflicts).toHaveLength(0);

    // Same rows, same ids, same updatedAt — genuinely untouched, not rewritten with equal values.
    expect(await prisma.operator.findMany({ orderBy: { name: "asc" } })).toEqual(before);
    expect(await prisma.operator.count()).toBe(4);
  });

  it("reports a conflict instead of overwriting a canonical name with different metadata", async () => {
    const existing = await prisma.operator.create({
      data: { name: "MAKERS", country: "PERU", track: "EARLY_SUPPORT" },
    });

    const result = await provisionOperators();
    expect(result.conflicts).toEqual([
      {
        name: "MAKERS",
        expected: { country: "COLOMBIA", track: "GROWTH_DEVELOPMENT" },
        actual: { country: "PERU", track: "EARLY_SUPPORT" },
      },
    ]);
    // The row is left exactly as it was — it may already have scholars pointing at it.
    expect(await prisma.operator.findUnique({ where: { id: existing.id } })).toEqual(existing);
    // The other three are still provisioned; one conflict doesn't block the rest.
    expect(result.created).toHaveLength(3);
  });

  it("never deletes or modifies operators outside the canonical catalog", async () => {
    const other = await prisma.operator.create({
      data: { name: "Some Other Partner", country: "PERU", track: "EARLY_SUPPORT" },
    });

    await provisionOperators();

    expect(await prisma.operator.findUnique({ where: { id: other.id } })).toEqual(other);
    expect(await prisma.operator.count()).toBe(5);
  });
});

describe("operator resolution once the catalog exists", () => {
  beforeEach(async () => {
    await provisionOperators();
    await prisma.university.create({
      data: { name: "UNMSM", country: "PERU", city: "Lima", type: "PUBLIC" },
    });
  });

  it("resolves the controlled FATV alias to Fundación Antivirus para la Deserción", async () => {
    const ctx = await loadValidationContext();
    const fatv = ctx.operatorsByName.get("fatv");
    const canonical = ctx.operatorsByName.get("fundación antivirus para la deserción");
    expect(fatv).toBeDefined();
    expect(fatv).toBe(canonical);
  });

  it("resolves each source label the sheet actually emits", async () => {
    const { result } = await syncScholars([
      ["S-FATV", "COLOMBIA", "FATV"],
      ["S-ESCALO", "PERU", "ESCALO"],
      ["S-MAKERS", "COLOMBIA", "MAKERS"],
      ["S-CE", "COLOMBIA", "Confident English"],
    ]);
    expect(result.errorRows).toBe(0);

    const scholars = await prisma.scholar.findMany({
      where: { scholarId: { in: ["S-FATV", "S-ESCALO", "S-MAKERS", "S-CE"] } },
      select: { scholarId: true, operator: { select: { name: true } } },
    });
    const byId = new Map(scholars.map((s) => [s.scholarId, s.operator?.name ?? null]));
    expect(byId.get("S-FATV")).toBe("Fundación Antivirus para la Deserción");
    expect(byId.get("S-ESCALO")).toBe("ESCALO");
    expect(byId.get("S-MAKERS")).toBe("MAKERS");
    expect(byId.get("S-CE")).toBe("Confident English");
  });

  it("leaves 'Not applicable', 'No aplica' and blank unassigned", async () => {
    const { result } = await syncScholars([
      ["S-NA", "COLOMBIA", "Not applicable"],
      ["S-ES", "COLOMBIA", "No aplica"],
      ["S-BLANK", "COLOMBIA", ""],
    ]);
    expect(result.errorRows).toBe(0);

    const scholars = await prisma.scholar.findMany({
      where: { scholarId: { in: ["S-NA", "S-ES", "S-BLANK"] } },
      select: { scholarId: true, operatorId: true },
    });
    expect(scholars).toHaveLength(3);
    for (const s of scholars) expect(s.operatorId).toBeNull();
  });

  it("keeps an unknown operator unresolved without fabricating a row or dropping the scholar", async () => {
    const { result } = await syncScholars([["S-UNKNOWN", "COLOMBIA", "Some New Partner"]]);

    // The scholar still lands — an unrecognized operator must not reject the row.
    expect(result.errorRows).toBe(0);
    const scholar = await prisma.scholar.findUnique({ where: { scholarId: "S-UNKNOWN" } });
    expect(scholar).not.toBeNull();
    expect(scholar?.operatorId).toBeNull();
    // ...and no operator was invented for it.
    expect(await prisma.operator.count()).toBe(4);
    expect(await prisma.operator.findFirst({ where: { name: "Some New Partner" } })).toBeNull();
  });
});

describe("production recovery: a normal sync repopulates existing scholars", () => {
  it("updates scholars from null operatorId to the resolved FK on the next sync", async () => {
    await prisma.university.create({
      data: { name: "UNMSM", country: "PERU", city: "Lima", type: "PUBLIC" },
    });

    // 1. The production state: no Operator catalog, so a sync commits scholars unassigned.
    const first = await syncScholars([
      ["S-1", "COLOMBIA", "FATV"],
      ["S-2", "PERU", "ESCALO"],
      ["S-3", "COLOMBIA", "Not applicable"],
    ]);
    expect(first.result.errorRows).toBe(0);
    expect(await prisma.scholar.count({ where: { operatorId: null } })).toBe(4); // + the fixture
    const before = await prisma.scholar.findUnique({ where: { scholarId: "S-1" } });

    // 2. Provision the catalog. Scholars are NOT touched by this step.
    await provisionOperators();
    expect(await prisma.scholar.count({ where: { operatorId: { not: null } } })).toBe(0);

    // 3. Re-run the same sync — the source column now resolves.
    const second = await syncScholars([
      ["S-1", "COLOMBIA", "FATV"],
      ["S-2", "PERU", "ESCALO"],
      ["S-3", "COLOMBIA", "Not applicable"],
    ]);
    expect(second.result.errorRows).toBe(0);

    const after = await prisma.scholar.findMany({
      where: { scholarId: { in: ["S-1", "S-2", "S-3"] } },
      select: { scholarId: true, operator: { select: { name: true } } },
      orderBy: { scholarId: "asc" },
    });
    expect(after.map((s) => s.operator?.name ?? null)).toEqual([
      "Fundación Antivirus para la Deserción",
      "ESCALO",
      null,
    ]);

    // No scholar was duplicated, and nothing else on the row regressed.
    expect(await prisma.scholar.count({ where: { scholarId: { startsWith: "S-" } } })).toBe(3);
    const updated = await prisma.scholar.findUnique({ where: { scholarId: "S-1" } });
    expect(updated).toMatchObject({
      fullName: before!.fullName,
      country: before!.country,
      cohort: before!.cohort,
      universityId: before!.universityId,
      academicProgram: before!.academicProgram,
      gender: before!.gender,
      programStatus: before!.programStatus,
    });
  });
});
