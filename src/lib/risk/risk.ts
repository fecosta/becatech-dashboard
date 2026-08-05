// Risk math for the Beca Tech dashboard — the single source of truth for the
// official five-level taxonomy (0–4), global risk, month-over-month change, and
// alert type. Shared by the seed, the dashboard query layer, and the tests.
//
// No I/O here: pure functions over numbers/enums so they are trivial to unit test.
import { AlertType, RiskChangeLabel, RiskLevel } from "../../generated/prisma/enums";

/** Numeric value (0–4) for each risk level. */
export const RISK_VALUE_BY_LEVEL: Record<RiskLevel, number> = {
  SIN_RIESGO: 0,
  RIESGO_BAJO: 1,
  RIESGO_MEDIO: 2,
  RIESGO_ALTO: 3,
  CRITICO: 4,
};

/** Risk level for each numeric value (0–4). */
export const RISK_LEVEL_BY_VALUE: Record<number, RiskLevel> = {
  0: RiskLevel.SIN_RIESGO,
  1: RiskLevel.RIESGO_BAJO,
  2: RiskLevel.RIESGO_MEDIO,
  3: RiskLevel.RIESGO_ALTO,
  4: RiskLevel.CRITICO,
};

/** Clamp any number into 0–4 and map to a RiskLevel. */
export function riskLevelFromValue(value: number): RiskLevel {
  const clamped = Math.max(0, Math.min(4, Math.round(value)));
  return RISK_LEVEL_BY_VALUE[clamped];
}

export function riskValueFromLevel(level: RiskLevel): number {
  return RISK_VALUE_BY_LEVEL[level];
}

/**
 * Global risk = the worst of the dimensions that HAVE data (brief §6):
 *   globalRiskValue = max(present dimensions)
 * A null dimension is "not assessed" and contributes nothing — so missing data can never inflate
 * global risk. When every dimension is null (nothing assessed), global is 0 (SIN_RIESGO); callers
 * pair that with `assessmentComplete: false` + `missingInputs` so it reads as "Insufficient Data",
 * never as an inferred CRITICO. Plain numbers (no nulls) reduce to the original max, unchanged.
 */
export function computeGlobalRiskValue(
  academic: number | null,
  psychosocial: number | null,
  participation: number | null,
): number {
  const present = [academic, psychosocial, participation].filter((v): v is number => v != null);
  return present.length ? Math.max(...present) : 0;
}

export type RiskDimension = "academic" | "psychosocial" | "participation";

/**
 * Assessment completeness from the three (possibly-null) dimension values. `missingInputs` names
 * the not-assessed dimensions in a stable order; `assessmentComplete` is true only when all three
 * have data. Used to distinguish real risk from missing data without changing the risk taxonomy.
 */
export function computeAssessmentCompleteness(
  academic: number | null,
  psychosocial: number | null,
  participation: number | null,
): { assessmentComplete: boolean; missingInputs: RiskDimension[] } {
  const missingInputs: RiskDimension[] = [];
  if (academic == null) missingInputs.push("academic");
  if (psychosocial == null) missingInputs.push("psychosocial");
  if (participation == null) missingInputs.push("participation");
  return { assessmentComplete: missingInputs.length === 0, missingInputs };
}

/** riskChange = current − previous. Returns null when there is no previous value. */
export function computeRiskChange(
  currentGlobalValue: number,
  previousGlobalValue: number | null | undefined,
): number | null {
  if (previousGlobalValue === null || previousGlobalValue === undefined) {
    return null;
  }
  return currentGlobalValue - previousGlobalValue;
}

/** Map a risk change delta to its label (brief §6). */
export function riskChangeLabel(change: number | null | undefined): RiskChangeLabel | null {
  if (change === null || change === undefined) return null;
  if (change <= -2) return RiskChangeLabel.STRONG_IMPROVEMENT;
  if (change === -1) return RiskChangeLabel.IMPROVED;
  if (change === 0) return RiskChangeLabel.STABLE;
  if (change === 1) return RiskChangeLabel.WORSENED;
  return RiskChangeLabel.SIGNIFICANT_DETERIORATION; // change >= 2
}

/**
 * Alert type from the dimension(s) driving the maximum risk.
 * NONE when there is no risk; COMBINED when two or more dimensions tie for the max.
 */
export function computeAlertType(
  academic: number | null,
  psychosocial: number | null,
  participation: number | null,
): AlertType {
  const max = computeGlobalRiskValue(academic, psychosocial, participation);
  if (max <= 0) return AlertType.NONE;

  // A not-assessed (null) dimension can never be a driver.
  const drivers: AlertType[] = [];
  if (academic != null && academic === max) drivers.push(AlertType.ACADEMIC);
  if (psychosocial != null && psychosocial === max) drivers.push(AlertType.PSYCHOSOCIAL);
  if (participation != null && participation === max) drivers.push(AlertType.PARTICIPATION);

  return drivers.length > 1 ? AlertType.COMBINED : drivers[0];
}
