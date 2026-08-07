import { describe, expect, it } from "vitest";
import type { Country } from "@/generated/prisma/enums";
import { PROGRAM_CALENDAR, resolveProgramMonth } from "@/lib/program-calendar";

const CO = "COLOMBIA" as Country;
const PE = "PERU" as Country;

/** A UTC-midnight Date for an ISO "YYYY-MM-DD" day. */
const day = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
/** Epoch ms of an ISO "YYYY-MM-DD" at UTC midnight. */
const ms = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
};

describe("resolveProgramMonth", () => {
  it("resolves an interior date to the right MES + semester, both countries", () => {
    expect(resolveProgramMonth(CO, day("2026-03-01"))).toEqual({ semester: "2026-1", programMonth: "MES 1" });
    expect(resolveProgramMonth(CO, day("2026-05-01"))).toEqual({ semester: "2026-1", programMonth: "MES 3" });
    expect(resolveProgramMonth(CO, day("2026-07-20"))).toEqual({ semester: "2026-1", programMonth: "MES 6" });
    expect(resolveProgramMonth(PE, day("2026-03-15"))).toEqual({ semester: "2026-1", programMonth: "MES 1" });
    expect(resolveProgramMonth(PE, day("2026-04-15"))).toEqual({ semester: "2026-1", programMonth: "MES 2" });
    expect(resolveProgramMonth(PE, day("2026-07-31"))).toEqual({ semester: "2026-1", programMonth: "MES 5" });
  });

  it("includes both boundary dates of every configured window (inclusive)", () => {
    for (const [country, windows] of Object.entries(PROGRAM_CALENDAR)) {
      for (const w of windows) {
        expect(resolveProgramMonth(country as Country, day(w.start))).toEqual({
          semester: w.semester,
          programMonth: w.programMonth,
        });
        expect(resolveProgramMonth(country as Country, day(w.end))).toEqual({
          semester: w.semester,
          programMonth: w.programMonth,
        });
      }
    }
  });

  it("ignores time-of-day (a session late on the end day still resolves)", () => {
    // Colombia MES 1 ends 2026-03-15; 23:59 UTC is still that calendar day.
    expect(resolveProgramMonth(CO, new Date("2026-03-15T23:59:59.000Z"))).toEqual({
      semester: "2026-1",
      programMonth: "MES 1",
    });
  });

  it("guards Colombia's non-month-aligned off-by-ones (Mar 15 → MES 1, Mar 16 → MES 2)", () => {
    expect(resolveProgramMonth(CO, day("2026-03-15"))).toEqual({ semester: "2026-1", programMonth: "MES 1" });
    expect(resolveProgramMonth(CO, day("2026-03-16"))).toEqual({ semester: "2026-1", programMonth: "MES 2" });
    expect(resolveProgramMonth(CO, day("2026-04-14"))).toEqual({ semester: "2026-1", programMonth: "MES 2" });
    expect(resolveProgramMonth(CO, day("2026-04-15"))).toEqual({ semester: "2026-1", programMonth: "MES 3" });
  });

  it("returns null for a date before the earliest and after the latest window", () => {
    expect(resolveProgramMonth(CO, day("2026-02-16"))).toEqual({ semester: null, programMonth: null }); // CO opens Feb 17
    expect(resolveProgramMonth(CO, day("2026-08-01"))).toEqual({ semester: null, programMonth: null });
    expect(resolveProgramMonth(PE, day("2026-02-28"))).toEqual({ semester: null, programMonth: null }); // PE opens Mar 1
    expect(resolveProgramMonth(PE, day("2026-08-01"))).toEqual({ semester: null, programMonth: null });
  });

  it("returns null for an unconfigured semester/year (never extrapolates)", () => {
    expect(resolveProgramMonth(CO, day("2025-05-01"))).toEqual({ semester: null, programMonth: null });
    expect(resolveProgramMonth(PE, day("2027-05-01"))).toEqual({ semester: null, programMonth: null });
  });

  it("returns null for missing/invalid country or date (never guesses)", () => {
    expect(resolveProgramMonth(null, day("2026-05-01"))).toEqual({ semester: null, programMonth: null });
    expect(resolveProgramMonth(undefined, day("2026-05-01"))).toEqual({ semester: null, programMonth: null });
    expect(resolveProgramMonth(CO, null)).toEqual({ semester: null, programMonth: null });
    expect(resolveProgramMonth(CO, undefined)).toEqual({ semester: null, programMonth: null });
    expect(resolveProgramMonth(CO, new Date("not-a-date"))).toEqual({ semester: null, programMonth: null });
  });
});

// Property test: a bad future edit to the windows (an overlap or a gap) must fail loudly here.
describe("PROGRAM_CALENDAR is contiguous and non-overlapping per country", () => {
  for (const [country, windows] of Object.entries(PROGRAM_CALENDAR)) {
    it(`${country}: each window is valid and each MES starts the day after the previous ends`, () => {
      const sorted = [...windows].sort((a, b) => ms(a.start) - ms(b.start));
      expect(sorted).toEqual(windows); // config is authored in chronological order
      for (const w of windows) {
        expect(ms(w.start)).toBeLessThanOrEqual(ms(w.end)); // start <= end
      }
      const ONE_DAY = 24 * 60 * 60 * 1000;
      for (let i = 1; i < sorted.length; i++) {
        expect(ms(sorted[i].start)).toBe(ms(sorted[i - 1].end) + ONE_DAY); // contiguous, no overlap, no gap
      }
    });
  }
});
