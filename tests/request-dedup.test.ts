import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// React's cache() only memoizes inside an RSC Flight render: outside one (here, in plain
// Vitest) the client build it resolves to is a documented no-op pass-through, so a test
// calling the real `react` package could never demonstrate the dedup this file is meant to
// verify. Stubbing the `cache` seam with a minimal memoizer lets us assert OUR wiring —
// that current-user.ts/queries.ts genuinely route these reads through cache() — without
// depending on React's real "react-server" condition, which Vitest never sets. Every
// function wrapped with cache() in this codebase today takes either zero arguments or the
// same object reference per call site, so a single-slot memoizer (ignoring arguments) is
// an accurate enough stand-in; it is not meant to model React's full argument-keyed cache.
vi.mock("react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react")>()),
  cache:
    <A extends unknown[], R>(fn: (...args: A) => R) =>
    (() => {
      let hit = false;
      let value: R;
      return (...args: A): R => {
        if (!hit) {
          hit = true;
          value = fn(...args);
        }
        return value;
      };
    })(),
}));

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/db", () => ({
  prisma: {
    appUser: { findUnique: vi.fn() },
    scholar: { findMany: vi.fn() },
    university: { findMany: vi.fn() },
    riskAssessment: { findMany: vi.fn() },
    monthlyCheckin: { findMany: vi.fn() },
    mentorReport: { findMany: vi.fn() },
  },
}));

import { Permission } from "@/lib/auth/authorization";
import { prisma } from "@/lib/db";
import { createClient } from "@/lib/supabase/server";
import type { DashboardFilters } from "@/lib/dashboard/types";

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://test.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_test");
});

// Each case gets a fresh module instance: cache() is applied once at module load, so its
// memo is per module instance — reusing one across tests would leak one test's cached
// result into the next (same technique as tests/supabase/admin.test.ts).
afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
  vi.clearAllMocks();
});

describe("request-scoped dedup", () => {
  it("resolves the current user once when the layout and a page guard both ask", async () => {
    const getUser = vi.fn().mockResolvedValue({ data: { user: { email: "pm@becatech.test" } } });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(createClient).mockResolvedValue({ auth: { getUser } } as any);
    vi.mocked(prisma.appUser.findUnique).mockResolvedValue({
      id: "u2",
      email: "pm@becatech.test",
      role: "PROGRAM_MANAGER",
      fullName: "PM",
      isActive: true,
      scholarAccess: [],
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    const { getCurrentUserResult } = await import("@/lib/auth/current-user");
    const { requirePermission } = await import("@/lib/auth/guard");

    const fromLayout = await getCurrentUserResult(); // layout.tsx:49
    const { user, allowed } = await requirePermission(Permission.VIEW_DASHBOARD); // page.tsx:89

    expect(getUser).toHaveBeenCalledTimes(1);
    expect(prisma.appUser.findUnique).toHaveBeenCalledTimes(1);
    expect(allowed).toBe(true);
    expect(fromLayout).toEqual({
      status: "ok",
      user: { id: "u2", email: "pm@becatech.test", role: "PROGRAM_MANAGER", fullName: "PM", assignedScholarIds: [] },
    });
    expect(user).toEqual(fromLayout.status === "ok" ? fromLayout.user : null);
  });

  it("reads filter options once when the layout and the page both request them", async () => {
    vi.mocked(prisma.scholar.findMany).mockResolvedValue([
      { cohort: "Cohorte 2025", currentDepartment: "Antioquia" },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ] as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(prisma.university.findMany).mockResolvedValue([{ name: "UdeA" }] as any);
    // The periods read has no `where`; the semesters read filters `semester: { not: null }`.
    vi.mocked(prisma.riskAssessment.findMany).mockImplementation(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (args: any) => Promise.resolve((args?.where ? [{ semester: "2026-1" }] : [{ period: "MES 1" }]) as any),
    );

    const { getFilterOptions } = await import("@/lib/dashboard/queries");

    // layout.tsx:49 and page.tsx:132 both call this within the same render.
    const [fromLayout, fromPage] = await Promise.all([getFilterOptions(), getFilterOptions()]);

    expect(prisma.scholar.findMany).toHaveBeenCalledTimes(1);
    expect(prisma.university.findMany).toHaveBeenCalledTimes(1);
    expect(prisma.riskAssessment.findMany).toHaveBeenCalledTimes(2); // periods + semesters, once each
    expect(fromLayout).toBe(fromPage);
    expect(fromLayout).toEqual({
      cohorts: ["Cohorte 2025"],
      universities: ["UdeA"],
      periods: ["MES 1"],
      departments: ["Antioquia"],
      semesters: ["2026-1"],
    });
  });

  it("resolves the current period once across two query functions sharing one filters object", async () => {
    // Empty scope short-circuits currentRiskByScholar/reportSets (queries.ts:268,280), isolating
    // the "latest period" lookup as the only remaining prisma.riskAssessment.findMany call site.
    vi.mocked(prisma.scholar.findMany).mockResolvedValue([]);
    vi.mocked(prisma.riskAssessment.findMany).mockResolvedValue([{ period: "MES 3" }]);

    const { getRiskStageSummary, getUniversityRiskBreakdown } = await import("@/lib/dashboard/queries");
    const filters: DashboardFilters = {}; // one shared reference, no `period` pinned — the common case

    const [summary, breakdown] = await Promise.all([
      getRiskStageSummary(filters), // early-support/page.tsx style call
      getUniversityRiskBreakdown(filters), // sibling call, same render
    ]);

    expect(prisma.riskAssessment.findMany).toHaveBeenCalledTimes(1);
    expect(summary.currentPeriod).toBe("MES 3");
    expect(breakdown).toEqual([]);
  });
});
