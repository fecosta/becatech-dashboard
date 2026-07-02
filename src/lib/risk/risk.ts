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
 * Global risk = the worst of the three dimensions (brief §6):
 *   globalRiskValue = max(academic, psychosocial, participation)
 */
export function computeGlobalRiskValue(
  academic: number,
  psychosocial: number,
  participation: number,
): number {
  return Math.max(academic, psychosocial, participation);
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
  academic: number,
  psychosocial: number,
  participation: number,
): AlertType {
  const max = Math.max(academic, psychosocial, participation);
  if (max <= 0) return AlertType.NONE;

  const drivers: AlertType[] = [];
  if (academic === max) drivers.push(AlertType.ACADEMIC);
  if (psychosocial === max) drivers.push(AlertType.PSYCHOSOCIAL);
  if (participation === max) drivers.push(AlertType.PARTICIPATION);

  return drivers.length > 1 ? AlertType.COMBINED : drivers[0];
}
