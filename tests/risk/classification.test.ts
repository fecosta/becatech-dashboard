import { describe, expect, it } from "vitest";
import { parseRiskClassification } from "@/lib/risk/classification";

// The SUPPORT ACTIVITY LOG stores risk in two vocabularies — the global column ("RIESGO …") and
// the per-axis columns ("… ALERTAS/BAJO/…") — both mapping onto the 5-level RiskLevel taxonomy.
describe("parseRiskClassification", () => {
  it("maps the global-risk vocabulary", () => {
    expect(parseRiskClassification("SIN RIESGO")).toBe("SIN_RIESGO");
    expect(parseRiskClassification("RIESGO BAJO")).toBe("RIESGO_BAJO");
    expect(parseRiskClassification("RIESGO MEDIO")).toBe("RIESGO_MEDIO");
    expect(parseRiskClassification("RIESGO ALTO")).toBe("RIESGO_ALTO");
    expect(parseRiskClassification("RIESGO CRÍTICO")).toBe("CRITICO");
  });

  it("maps the per-axis vocabulary", () => {
    expect(parseRiskClassification("SIN ALERTAS")).toBe("SIN_RIESGO");
    expect(parseRiskClassification("BAJO")).toBe("RIESGO_BAJO");
    expect(parseRiskClassification("MEDIO")).toBe("RIESGO_MEDIO");
    expect(parseRiskClassification("ALTO")).toBe("RIESGO_ALTO");
    expect(parseRiskClassification("CRÍTICO")).toBe("CRITICO");
  });

  it("is accent- and case- and whitespace-insensitive", () => {
    expect(parseRiskClassification("riesgo critico")).toBe("CRITICO"); // no accent
    expect(parseRiskClassification("  Riesgo   Alto ")).toBe("RIESGO_ALTO");
  });

  it("returns null for blank or unknown values (never guesses)", () => {
    expect(parseRiskClassification("")).toBeNull();
    expect(parseRiskClassification("   ")).toBeNull();
    expect(parseRiskClassification(null)).toBeNull();
    expect(parseRiskClassification(undefined)).toBeNull();
    expect(parseRiskClassification("TOTALMENTE PERDIDO")).toBeNull();
  });
});
