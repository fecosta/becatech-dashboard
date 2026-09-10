import { describe, expect, it } from "vitest";
import {
  ALL_BLOCK_FILTER_PARAMS,
  applyBlockFilters,
  applyFilterParamChange,
  blockParamName,
  clearBlockFilters,
  filterValueOf,
  parseBlockFilters,
  preserveParams,
  visiblePillsForPath,
} from "@/lib/dashboard/filters";

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

  it("Early Support additionally shows a semester pill (M1→M6 trend, ADR-008)", () => {
    expect(visiblePillsForPath("/dashboard/early-support")).toEqual([
      "cohort",
      "country",
      "university",
      "semester",
    ]);
  });

  it("Growth & Development shows cohort/country/university only", () => {
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


// SPEC-004 — per-section block filters: their URL namespace, how they layer over the page's
// global filters, and the reset/clear rules that keep sections independent.
describe("blockParamName / ALL_BLOCK_FILTER_PARAMS", () => {
  it("namespaces a dimension under its block", () => {
    expect(blockParamName("ourScholars", "country")).toBe("ourScholarsCountry");
    expect(blockParamName("dropOuts", "cohort")).toBe("dropOutsCohort");
    expect(blockParamName("earlySupportStatus", "university")).toBe("earlySupportStatusUniversity");
  });

  it("never collides with a global filter key", () => {
    for (const param of ALL_BLOCK_FILTER_PARAMS) {
      expect(["country", "cohort", "university", "status", "risk", "period", "department", "semester"])
        .not.toContain(param);
    }
  });
});

describe("parseBlockFilters", () => {
  it("reads only the requested block's params", () => {
    const sp = { ourScholarsCountry: "PERU", dropOutsCohort: "2025" };
    expect(parseBlockFilters(sp, "ourScholars")).toEqual({ country: "PERU" });
    expect(parseBlockFilters(sp, "dropOuts")).toEqual({ cohort: "2025" });
    expect(parseBlockFilters(sp, "programRetention")).toEqual({});
  });

  it("ignores an invalid country enum", () => {
    expect(parseBlockFilters({ ourScholarsCountry: "MARS" }, "ourScholars")).toEqual({
      country: undefined,
    });
  });
});

describe("applyBlockFilters", () => {
  it("a block value overrides the global one for that block", () => {
    expect(
      applyBlockFilters({ country: "COLOMBIA", cohort: "2024" }, { country: "PERU" }),
    ).toEqual({ country: "PERU", cohort: "2024" });
  });

  it("an unset block dimension inherits the global value", () => {
    expect(applyBlockFilters({ country: "COLOMBIA", cohort: "2024" }, {})).toEqual({
      country: "COLOMBIA",
      cohort: "2024",
    });
  });

  it("an undefined block value never blanks an inherited global one", () => {
    expect(
      applyBlockFilters({ country: "COLOMBIA" }, { country: undefined, cohort: "2026" }),
    ).toEqual({ country: "COLOMBIA", cohort: "2026" });
  });

  it("carries non-block dimensions through untouched", () => {
    const scope = applyBlockFilters(
      { country: "COLOMBIA", programStatus: "ACTIVE", period: "2026-06" },
      { cohort: "2025" },
    );
    expect(scope.programStatus).toBe("ACTIVE");
    expect(scope.period).toBe("2026-06");
  });
});

// The domain-level stand-in for "the owning block moves, its siblings don't" — there is no
// component-test harness in this repo, so scope objects are what gets asserted.
describe("effective block scopes on one page", () => {
  const sp = { country: "COLOMBIA", ourScholarsCohort: "2026" };
  const globals = { country: "COLOMBIA" as const };

  it("only the filtered block's scope differs from the page scope", () => {
    const ourScholars = applyBlockFilters(globals, parseBlockFilters(sp, "ourScholars"));
    const dropOuts = applyBlockFilters(globals, parseBlockFilters(sp, "dropOuts"));
    const retention = applyBlockFilters(globals, parseBlockFilters(sp, "programRetention"));

    expect(ourScholars).toEqual({ country: "COLOMBIA", cohort: "2026" });
    expect(dropOuts).toEqual(globals);
    expect(retention).toEqual(globals);
  });

  it("every block still sits inside the page's global scope", () => {
    for (const block of ["ourScholars", "dropOuts", "programRetention"] as const) {
      expect(applyBlockFilters(globals, parseBlockFilters(sp, block)).country).toBe("COLOMBIA");
    }
  });
});

describe("applyFilterParamChange (global filter changes)", () => {
  it("sets the changed key and preserves other global params", () => {
    const params = applyFilterParamChange("country=COLOMBIA&cohort=2025", "cohort", "2026");
    expect(params.get("country")).toBe("COLOMBIA");
    expect(params.get("cohort")).toBe("2026");
  });

  it("an empty value clears the key", () => {
    expect(applyFilterParamChange("country=COLOMBIA", "country", "").has("country")).toBe(false);
  });

  it("a block filter's own change leaves globals and sibling blocks alone", () => {
    const params = applyFilterParamChange(
      "country=COLOMBIA&ourScholarsCohort=2025&dropOutsCountry=PERU",
      "ourScholarsCohort",
      "2026",
    );
    expect(params.get("country")).toBe("COLOMBIA");
    expect(params.get("dropOutsCountry")).toBe("PERU");
    expect(params.get("ourScholarsCohort")).toBe("2026");
  });

  it("a global change resets every block namespace on the page", () => {
    const params = applyFilterParamChange(
      "country=COLOMBIA&cohort=2025&ourScholarsCountry=PERU&dropOutsCohort=2024&programRetentionUniversity=UPC",
      "country",
      "PERU",
      { resetBlockFilters: true },
    );
    expect(params.get("country")).toBe("PERU"); // the deliberate change sticks
    expect(params.get("cohort")).toBe("2025"); // other globals are left alone
    expect(params.has("ourScholarsCountry")).toBe(false);
    expect(params.has("dropOutsCohort")).toBe(false);
    expect(params.has("programRetentionUniversity")).toBe(false);
  });
});

describe("clearBlockFilters", () => {
  it("clears one block without touching globals or a sibling block", () => {
    const params = clearBlockFilters(
      "country=COLOMBIA&ourScholarsCountry=PERU&dropOutsCohort=2024&dropOutsCountry=PERU",
      "dropOuts",
    );
    expect(params.get("country")).toBe("COLOMBIA");
    expect(params.get("ourScholarsCountry")).toBe("PERU");
    expect(params.has("dropOutsCohort")).toBe(false);
    expect(params.has("dropOutsCountry")).toBe(false);
  });
});

describe("filterValueOf", () => {
  // Block controls label their inherit option with this, so an unset control reports the scope
  // its block is actually on instead of claiming "all".
  it("reads the global value a block would inherit", () => {
    expect(filterValueOf({ cohort: "2025" }, "cohort")).toBe("2025");
    expect(filterValueOf({ programStatus: "ACTIVE" }, "status")).toBe("ACTIVE");
    expect(filterValueOf({}, "country")).toBeUndefined();
  });
});
