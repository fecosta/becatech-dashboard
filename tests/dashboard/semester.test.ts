import { describe, expect, it } from "vitest";
import { compareSemesters, formatSemesterLabel, latestSemester, parseSemester } from "@/lib/dashboard/semester";

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

describe("formatSemesterLabel", () => {
  it("labels term 1 as First semester", () => {
    expect(formatSemesterLabel("2026-1")).toBe("First semester");
    expect(formatSemesterLabel("2031-1")).toBe("First semester");
  });

  it("labels term 2 as Second semester", () => {
    expect(formatSemesterLabel("2026-2")).toBe("Second semester");
    expect(formatSemesterLabel("2025-2")).toBe("Second semester");
  });

  // The field names the semester, not the term code — the year is parsed but never displayed.
  it("never shows the year for a valid semester", () => {
    for (const term of ["2025-1", "2025-2", "2026-1", "2026-2", "2031-1"]) {
      expect(formatSemesterLabel(term)).not.toMatch(/\d/);
    }
  });

  it("shows an unexpected/non-standard value raw, without inventing a meaning", () => {
    expect(formatSemesterLabel("2026-3")).toBe("2026-3");
    expect(formatSemesterLabel("MES 3")).toBe("MES 3");
    expect(formatSemesterLabel("2026-06")).toBe("2026-06");
  });

  it("uses the established missing-value dash", () => {
    expect(formatSemesterLabel(null)).toBe("—");
    expect(formatSemesterLabel(undefined)).toBe("—");
    expect(formatSemesterLabel("")).toBe("—");
  });
});
