import { describe, expect, it } from "vitest";
import { latestCohort } from "@/lib/dashboard/cohort";
import { normalizeGender } from "@/lib/dashboard/gender";

describe("normalizeGender", () => {
  it("maps the seed's full-word values", () => {
    expect(normalizeGender("Female")).toBe("female");
    expect(normalizeGender("Male")).toBe("male");
    expect(normalizeGender("Non-binary")).toBe("other");
    expect(normalizeGender("Prefer not to say")).toBe("unknown");
  });
  it("maps M/F and Spanish variants, case- and space-insensitive", () => {
    expect(normalizeGender(" f ")).toBe("female");
    expect(normalizeGender("M")).toBe("male");
    expect(normalizeGender("Femenino")).toBe("female");
    expect(normalizeGender("Masculino")).toBe("male");
    expect(normalizeGender("Mujer")).toBe("female");
    expect(normalizeGender("Hombre")).toBe("male");
  });
  it("treats empty / null / unrecognized as unknown", () => {
    expect(normalizeGender("")).toBe("unknown");
    expect(normalizeGender(null)).toBe("unknown");
    expect(normalizeGender(undefined)).toBe("unknown");
    expect(normalizeGender("xyz")).toBe("unknown");
  });
});

describe("latestCohort", () => {
  it("picks the numerically-latest cohort", () => {
    expect(latestCohort(["2024", "2026", "2025"])).toBe("2026");
    expect(latestCohort(["2024-1", "2024-2", "2025-1"])).toBe("2025-1");
  });
  it("ignores empties and returns null when none are usable", () => {
    expect(latestCohort([null, undefined, "  ", "2023"])).toBe("2023");
    expect(latestCohort([])).toBeNull();
    expect(latestCohort([null, ""])).toBeNull();
  });
});
