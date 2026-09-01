import { describe, expect, it } from "vitest";
import { filterChipsFor, preserveParams, visiblePillsForPath } from "@/lib/dashboard/filters";

// preserveParams builds the filter-preserving query string used by the deprecated-route
// redirect stubs (risk-alerts → early-support, tracking → its new destinations, etc.).
describe("preserveParams (filter-preserving redirect builder)", () => {
  it("keeps existing filters and applies overrides", () => {
    const p = new URLSearchParams(
      preserveParams({ country: "COLOMBIA", cohort: "2025" }, { risk: "CRITICO" }),
    );
    expect(p.get("country")).toBe("COLOMBIA");
    expect(p.get("cohort")).toBe("2025");
    expect(p.get("risk")).toBe("CRITICO");
  });

  it("override replaces an existing param", () => {
    const p = new URLSearchParams(preserveParams({ risk: "RIESGO_BAJO" }, { risk: "CRITICO" }));
    expect(p.get("risk")).toBe("CRITICO");
  });

  it("drops empty values and takes the first of arrays", () => {
    const p = new URLSearchParams(preserveParams({ country: "", university: ["Uni A", "Uni B"] }));
    expect(p.has("country")).toBe(false);
    expect(p.get("university")).toBe("Uni A");
  });

  it("returns an empty string when there is nothing to preserve", () => {
    expect(preserveParams({})).toBe("");
    expect(preserveParams({ tab: "" })).toBe("");
  });
});

describe("visiblePillsForPath", () => {
  it("Home shows cohort/country/university/department", () => {
    expect(visiblePillsForPath("/dashboard")).toEqual([
      "cohort",
      "country",
      "university",
      "department",
    ]);
  });

  it("Early Support and Growth & Development show cohort/country/university only", () => {
    expect(visiblePillsForPath("/dashboard/early-support")).toEqual([
      "cohort",
      "country",
      "university",
    ]);
    expect(visiblePillsForPath("/dashboard/career-readiness")).toEqual([
      "cohort",
      "country",
      "university",
    ]);
  });

  it("Program Ecosystem shows cohort/country/university only", () => {
    expect(visiblePillsForPath("/dashboard/actors")).toEqual(["cohort", "country", "university"]);
  });

  it("Scholar Profile puts university first and includes status/risk", () => {
    expect(visiblePillsForPath("/dashboard/scholars")).toEqual([
      "university",
      "country",
      "cohort",
      "status",
      "risk",
    ]);
    expect(visiblePillsForPath("/dashboard/scholars/BT-CO-001")).toEqual([
      "university",
      "country",
      "cohort",
      "status",
      "risk",
    ]);
    // The section's three screens share one pill set — matched by prefix, so the split
    // into /dashboard/scholars, /find and /[scholarId] needed no change here.
    expect(visiblePillsForPath("/dashboard/scholars/find")).toEqual([
      "university",
      "country",
      "cohort",
      "status",
      "risk",
    ]);
  });

  it("out-of-scope routes keep the full pill set", () => {
    expect(visiblePillsForPath("/dashboard/unit-economics")).toEqual([
      "country",
      "cohort",
      "university",
      "status",
      "risk",
      "period",
    ]);
    expect(visiblePillsForPath("/dashboard/admin/imports")).toEqual([
      "country",
      "cohort",
      "university",
      "status",
      "risk",
      "period",
    ]);
  });
});

describe("filterChipsFor", () => {
  it("reads 'all' when a filter is unset", () => {
    expect(filterChipsFor({}, ["cohort", "country"])).toEqual([
      { label: "Cohort: all", tone: "black" },
      { label: "Country: all", tone: "green" },
    ]);
  });

  it("reflects the applied value, so a card cannot disagree with the top bar", () => {
    const chips = filterChipsFor({ cohort: "Cohorte 2025", country: "PERU" }, [
      "cohort",
      "country",
    ]);
    expect(chips.map((c) => c.label)).toEqual(["Cohort: Cohorte 2025", "Country: PERU"]);
  });

  // Same filter, same colour on every view — the design file is inconsistent about this.
  it("gives each filter a stable tone", () => {
    expect(filterChipsFor({}, ["risk"])[0].tone).toBe("purple");
    expect(filterChipsFor({}, ["university"])[0].tone).toBe("ghost");
  });
});
