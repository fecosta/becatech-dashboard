import { describe, expect, it } from "vitest";
import { compareSemesters, latestSemester, parseSemester } from "@/lib/dashboard/semester";

describe("parseSemester", () => {
  it("parses a YYYY-N label into year/term", () => {
    expect(parseSemester("2026-1")).toEqual({ year: 2026, term: 1 });
    expect(parseSemester("2026-2")).toEqual({ year: 2026, term: 2 });
  });

  it("returns null for anything not shaped that way", () => {
    expect(parseSemester("MES 3")).toBeNull();
    expect(parseSemester("2026-06")).toBeNull(); // a calendar-month period, not a semester
    expect(parseSemester("")).toBeNull();
    expect(parseSemester(null)).toBeNull();
    expect(parseSemester(undefined)).toBeNull();
  });
});

describe("compareSemesters", () => {
  it("orders by year then term, not lexically", () => {
    expect(compareSemesters("2026-1", "2026-2")).toBeLessThan(0);
    expect(compareSemesters("2026-2", "2027-1")).toBeLessThan(0); // year wins over term
    expect(compareSemesters("2026-1", "2026-1")).toBe(0);
  });

  it("falls back to string comparison when either side isn't semester-shaped", () => {
    expect(compareSemesters("junk", "2026-1")).toBe("junk".localeCompare("2026-1"));
  });
});

describe("latestSemester", () => {
  it("picks the chronologically latest label", () => {
    expect(latestSemester(["2026-1", "2027-1", "2026-2"])).toBe("2027-1");
  });

  it("returns null for an empty list", () => {
    expect(latestSemester([])).toBeNull();
  });
});
