import { describe, expect, it } from "vitest";
import {
  computeAlertType,
  computeGlobalRiskValue,
  computeRiskChange,
  riskChangeLabel,
  riskLevelFromValue,
  riskValueFromLevel,
} from "@/lib/risk/risk";

describe("risk math", () => {
  it("global risk is the max of the three dimensions", () => {
    expect(computeGlobalRiskValue(1, 3, 2)).toBe(3);
    expect(computeGlobalRiskValue(0, 0, 0)).toBe(0);
  });

  it("maps values to levels and back, clamping out-of-range values", () => {
    expect(riskLevelFromValue(0)).toBe("SIN_RIESGO");
    expect(riskLevelFromValue(4)).toBe("CRITICO");
    expect(riskValueFromLevel("RIESGO_ALTO")).toBe(3);
    expect(riskLevelFromValue(9)).toBe("CRITICO");
  });

  it("computes month-over-month change (null when no previous)", () => {
    expect(computeRiskChange(3, 1)).toBe(2);
    expect(computeRiskChange(1, 3)).toBe(-2);
    expect(computeRiskChange(2, null)).toBeNull();
  });

  it("labels the risk change per the taxonomy", () => {
    expect(riskChangeLabel(-2)).toBe("STRONG_IMPROVEMENT");
    expect(riskChangeLabel(-1)).toBe("IMPROVED");
    expect(riskChangeLabel(0)).toBe("STABLE");
    expect(riskChangeLabel(1)).toBe("WORSENED");
    expect(riskChangeLabel(3)).toBe("SIGNIFICANT_DETERIORATION");
    expect(riskChangeLabel(null)).toBeNull();
  });

  it("derives the alert type from the driving dimension(s)", () => {
    expect(computeAlertType(0, 0, 0)).toBe("NONE");
    expect(computeAlertType(3, 1, 0)).toBe("ACADEMIC");
    expect(computeAlertType(1, 3, 0)).toBe("PSYCHOSOCIAL");
    expect(computeAlertType(1, 1, 3)).toBe("PARTICIPATION");
    expect(computeAlertType(3, 3, 1)).toBe("COMBINED");
  });
});
