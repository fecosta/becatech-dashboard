import { describe, expect, it } from "vitest";
import { gpaSummaryKpi, summarizeGpa } from "@/lib/academic/gpa-summary";

describe("summarizeGpa (country-aware, never blends scales)", () => {
  it("Colombia only: averages on the 0–5 scale, Peru empty", () => {
    const s = summarizeGpa([
      { gpa: 4.0, country: "COLOMBIA" },
      { gpa: 3.0, country: "COLOMBIA" },
    ]);
    expect(s.colombia).toEqual({ average: 3.5, scale: 5, count: 2 });
    expect(s.peru).toEqual({ average: null, scale: 20, count: 0 });
    // 4/5 = 0.8, 3/5 = 0.6 → mean 0.7 → 70%
    expect(s.normalizedOverallPercentage).toBe(70);
  });

  it("Peru only: averages on the 0–20 scale, Colombia empty", () => {
    const s = summarizeGpa([
      { gpa: 18, country: "PERU" },
      { gpa: 14, country: "PERU" },
    ]);
    expect(s.peru).toEqual({ average: 16, scale: 20, count: 2 });
    expect(s.colombia).toEqual({ average: null, scale: 5, count: 0 });
    // 18/20 = 0.9, 14/20 = 0.7 → mean 0.8 → 80%
    expect(s.normalizedOverallPercentage).toBe(80);
  });

  it("both countries: keeps each native average separate and computes a normalized index", () => {
    const s = summarizeGpa([
      { gpa: 5, country: "COLOMBIA" }, // 100%
      { gpa: 10, country: "PERU" }, // 50%
    ]);
    expect(s.colombia.average).toBe(5);
    expect(s.peru.average).toBe(10);
    // Never a blended raw mean like (5+10)/2 = 7.5; instead (1.0 + 0.5)/2 = 0.75 → 75%
    expect(s.normalizedOverallPercentage).toBe(75);
  });

  it("no records: all null / zero", () => {
    const s = summarizeGpa([]);
    expect(s.colombia).toEqual({ average: null, scale: 5, count: 0 });
    expect(s.peru).toEqual({ average: null, scale: 20, count: 0 });
    expect(s.normalizedOverallPercentage).toBeNull();
  });

  it("null and invalid GPAs are excluded, not clamped or coerced to zero", () => {
    const s = summarizeGpa([
      { gpa: 4, country: "COLOMBIA" },
      { gpa: null, country: "COLOMBIA" },
      { gpa: undefined, country: "COLOMBIA" },
      { gpa: Number.NaN, country: "COLOMBIA" },
      { gpa: -1, country: "COLOMBIA" }, // negative → invalid
      { gpa: 6, country: "COLOMBIA" }, // above the 0–5 scale → invalid
    ]);
    expect(s.colombia).toEqual({ average: 4, scale: 5, count: 1 });
    expect(s.normalizedOverallPercentage).toBe(80); // 4/5 only
  });

  it("a Peru-scale value (e.g. 17) is invalid on the Colombia scale and excluded", () => {
    const s = summarizeGpa([{ gpa: 17, country: "COLOMBIA" }]);
    expect(s.colombia).toEqual({ average: null, scale: 5, count: 0 });
    expect(s.normalizedOverallPercentage).toBeNull();
  });

  it("rounds the average to 2 decimals and the index to 1 decimal", () => {
    const s = summarizeGpa([
      { gpa: 4.005, country: "COLOMBIA" },
      { gpa: 3.0, country: "COLOMBIA" },
    ]);
    expect(s.colombia.average).toBe(3.5); // (4.005 + 3) / 2 = 3.5025 → 3.5
    const s2 = summarizeGpa([
      { gpa: 1, country: "COLOMBIA" }, // 20%
      { gpa: 1, country: "COLOMBIA" }, // 20%
      { gpa: 2, country: "COLOMBIA" }, // 40%
    ]);
    // (0.2 + 0.2 + 0.4)/3 = 0.26666… → 26.7%
    expect(s2.normalizedOverallPercentage).toBe(26.7);
  });
});

describe("gpaSummaryKpi (English, scale-correct labels)", () => {
  it("both countries → Academic Performance Index as a percentage, never '/5' or 'Average GPA'", () => {
    const kpi = gpaSummaryKpi(summarizeGpa([
      { gpa: 4, country: "COLOMBIA" },
      { gpa: 16, country: "PERU" },
    ]));
    expect(kpi.label).toBe("Academic Performance Index");
    expect(kpi.value).toMatch(/%$/);
    expect(kpi.value).not.toContain("/5");
  });

  it("Colombia only → '/5' label", () => {
    const kpi = gpaSummaryKpi(summarizeGpa([{ gpa: 4.2, country: "COLOMBIA" }]));
    expect(kpi.label).toBe("Average GPA · Colombia");
    expect(kpi.value).toBe("4.20/5");
  });

  it("Peru only → '/20' label", () => {
    const kpi = gpaSummaryKpi(summarizeGpa([{ gpa: 16.5, country: "PERU" }]));
    expect(kpi.label).toBe("Average GPA · Peru");
    expect(kpi.value).toBe("16.50/20");
  });

  it("no data → em dash empty state", () => {
    const kpi = gpaSummaryKpi(summarizeGpa([]));
    expect(kpi.value).toBe("—");
  });
});
