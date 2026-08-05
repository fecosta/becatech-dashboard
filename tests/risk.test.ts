import { describe, expect, it } from "vitest";
import {
  computeAlertType,
  computeAssessmentCompleteness,
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

  it("global risk ignores not-assessed (null) dimensions — missing data never inflates risk", () => {
    // Participation not assessed (no support-activity rows): global = max(academic, psychosocial),
    // NOT 4. This is the fix for missing data masquerading as CRITICO.
    expect(computeGlobalRiskValue(1, 0, null)).toBe(1);
    // Everything not assessed → 0 (SIN_RIESGO), paired with assessmentComplete:false by callers,
    // so it reads as "Insufficient Data", never an inferred CRITICO.
    expect(computeGlobalRiskValue(null, null, null)).toBe(0);
    // A single present high dimension still drives global.
    expect(computeGlobalRiskValue(null, 4, null)).toBe(4);
  });

  it("reports assessment completeness and the missing dimensions in a stable order", () => {
    expect(computeAssessmentCompleteness(1, 2, 3)).toEqual({ assessmentComplete: true, missingInputs: [] });
    expect(computeAssessmentCompleteness(1, null, null)).toEqual({
      assessmentComplete: false,
      missingInputs: ["psychosocial", "participation"],
    });
    expect(computeAssessmentCompleteness(null, null, null)).toEqual({
      assessmentComplete: false,
      missingInputs: ["academic", "psychosocial", "participation"],
    });
  });

  it("a not-assessed dimension is never an alert driver", () => {
    // Participation null; academic drives.
    expect(computeAlertType(3, 1, null)).toBe("ACADEMIC");
    // All null → NONE.
    expect(computeAlertType(null, null, null)).toBe("NONE");
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
