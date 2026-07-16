import { describe, expect, it } from "vitest";
import { preserveParams } from "@/lib/dashboard/filters";
import { parseTrackingTab, TRACKING_TABS } from "@/lib/dashboard/tracking";

describe("parseTrackingTab", () => {
  it("accepts each known tab", () => {
    for (const t of TRACKING_TABS) expect(parseTrackingTab(t)).toBe(t);
  });
  it("defaults unknown / missing / empty to summary", () => {
    expect(parseTrackingTab(undefined)).toBe("summary");
    expect(parseTrackingTab("bogus")).toBe("summary");
    expect(parseTrackingTab("")).toBe("summary");
  });
  it("takes the first value of an array", () => {
    expect(parseTrackingTab(["years-3-5", "summary"])).toBe("years-3-5");
    expect(parseTrackingTab(["nope"])).toBe("summary");
  });
});

describe("preserveParams (filter-preserving redirect / tab URL builder)", () => {
  it("keeps existing filters and applies overrides", () => {
    const p = new URLSearchParams(
      preserveParams({ country: "COLOMBIA", cohort: "2025" }, { tab: "years-1-2" }),
    );
    expect(p.get("country")).toBe("COLOMBIA");
    expect(p.get("cohort")).toBe("2025");
    expect(p.get("tab")).toBe("years-1-2");
  });
  it("override replaces an existing param", () => {
    const p = new URLSearchParams(preserveParams({ tab: "summary", risk: "CRITICO" }, { tab: "scholars" }));
    expect(p.get("tab")).toBe("scholars");
    expect(p.get("risk")).toBe("CRITICO");
  });
  it("drops empty values and takes the first of arrays", () => {
    const p = new URLSearchParams(preserveParams({ country: "", university: ["Uni A", "Uni B"] }));
    expect(p.has("country")).toBe(false);
    expect(p.get("university")).toBe("Uni A");
  });
});
