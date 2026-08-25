import { describe, expect, it } from "vitest";
import { cohortYear, normalizeOrigin, originKey } from "@/lib/dashboard/origin";

describe("normalizeOrigin", () => {
  it("keeps a real department or region as written", () => {
    expect(normalizeOrigin("Antioquia")).toBe("Antioquia");
    expect(normalizeOrigin("  Valle del Cauca ")).toBe("Valle del Cauca");
  });

  it("treats the source's not-reported sentinels as missing", () => {
    for (const v of ["Sin información", "sin informacion", "N/A", "-", "", null, undefined]) {
      expect(normalizeOrigin(v)).toBeNull();
    }
  });
});

describe("originKey", () => {
  it("folds accent-only spelling differences onto one key", () => {
    expect(originKey("San Martín")).toBe(originKey("San Martin"));
    expect(originKey("BOGOTÁ")).toBe(originKey("Bogota"));
  });
});

describe("cohortYear", () => {
  it("reads the year out of either cohort spelling", () => {
    expect(cohortYear("Cohorte 2026")).toBe("2026");
    expect(cohortYear("2025")).toBe("2025");
  });

  it("returns null when the cohort carries no year", () => {
    expect(cohortYear("Piloto")).toBeNull();
    expect(cohortYear(null)).toBeNull();
  });
});
