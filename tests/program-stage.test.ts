import { describe, expect, it } from "vitest";
import {
  programStageFromSemester,
  YEARS_1_2_MAX_SEMESTER,
} from "@/lib/academic/program-stage";

describe("programStageFromSemester", () => {
  it("maps semesters 1..MAX to Years 1–2", () => {
    for (let s = 1; s <= YEARS_1_2_MAX_SEMESTER; s++) {
      expect(programStageFromSemester(s)).toBe("YEARS_1_2");
    }
  });

  it("maps semesters above MAX to Years 3–5", () => {
    expect(programStageFromSemester(YEARS_1_2_MAX_SEMESTER + 1)).toBe("YEARS_3_5");
    expect(programStageFromSemester(10)).toBe("YEARS_3_5");
  });

  it("returns null when the semester is unknown (neither band)", () => {
    expect(programStageFromSemester(null)).toBeNull();
    expect(programStageFromSemester(undefined)).toBeNull();
  });
});
