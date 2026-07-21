import { describe, expect, it } from "vitest";
import { preserveParams } from "@/lib/dashboard/filters";

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
