import { describe, expect, it } from "vitest";
import { isCohort2024 } from "@/lib/dashboard/cohort";
import { latestProgramMonth, programMonthNumber, sortProgramMonths } from "@/lib/dashboard/program-month";

// Program months ("MES n") order by number, never lexically — the earlier lexical max was the bug.
describe("programMonthNumber", () => {
  it("extracts the number from a MES label (case/space tolerant)", () => {
    expect(programMonthNumber("MES 1")).toBe(1);
    expect(programMonthNumber("  mes  10 ")).toBe(10);
    expect(programMonthNumber("2026-02")).toBeNull();
    expect(programMonthNumber(null)).toBeNull();
  });
});

describe("latestProgramMonth", () => {
  it("picks the highest MES by NUMBER, not lexically", () => {
    expect(latestProgramMonth(["MES 1", "MES 2", "MES 10", "MES 9"])).toBe("MES 10");
    expect(latestProgramMonth(["MES 3", "2026-06", "junk"])).toBe("MES 3"); // ignores non-MES
    expect(latestProgramMonth(["2026-06", "x"])).toBeNull();
  });
});

describe("sortProgramMonths", () => {
  it("sorts numerically, non-MES values last", () => {
    expect(sortProgramMonths(["MES 10", "MES 2", "MES 1"])).toEqual(["MES 1", "MES 2", "MES 10"]);
  });
});

describe("isCohort2024", () => {
  it("matches any cohort carrying 2024 (excluded from risk/retention denominators)", () => {
    expect(isCohort2024("Cohorte 2024 COL")).toBe(true);
    expect(isCohort2024("2024")).toBe(true);
    expect(isCohort2024("Cohorte 2025 PER")).toBe(false);
    expect(isCohort2024("2026")).toBe(false);
    expect(isCohort2024(null)).toBe(false);
  });
});
