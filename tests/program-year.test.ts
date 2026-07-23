import { describe, expect, it } from "vitest";
import { YEARS_1_2_MAX_SEMESTER } from "@/lib/academic/program-stage";
import { programYearFromSemester, YEAR_1_MAX_SEMESTER } from "@/lib/academic/program-year";

describe("programYearFromSemester", () => {
  it("maps semesters 1..YEAR_1_MAX to Year 1", () => {
    for (let s = 1; s <= YEAR_1_MAX_SEMESTER; s++) {
      expect(programYearFromSemester(s)).toBe("YEAR_1");
    }
  });

  it("maps semesters after Year 1 through YEARS_1_2_MAX_SEMESTER to Year 2", () => {
    for (let s = YEAR_1_MAX_SEMESTER + 1; s <= YEARS_1_2_MAX_SEMESTER; s++) {
      expect(programYearFromSemester(s)).toBe("YEAR_2");
    }
  });

  it("maps semesters above YEARS_1_2_MAX_SEMESTER to Year 3", () => {
    expect(programYearFromSemester(YEARS_1_2_MAX_SEMESTER + 1)).toBe("YEAR_3");
    expect(programYearFromSemester(10)).toBe("YEAR_3");
  });

  it("returns null when the semester is unknown", () => {
    expect(programYearFromSemester(null)).toBeNull();
    expect(programYearFromSemester(undefined)).toBeNull();
  });

  it("never lets Year 2 extend past the program-stage boundary", () => {
    expect(programYearFromSemester(YEARS_1_2_MAX_SEMESTER)).toBe("YEAR_2");
    expect(programYearFromSemester(YEARS_1_2_MAX_SEMESTER + 1)).not.toBe("YEAR_2");
  });
});
