// Month-over-month delta for a percentage-point trend series (e.g. the M1→M6 participation/risk
// trend). "Good"/"bad" is contextual per metric, not a fixed up=green convention — participation
// rising is an improvement, risk rising isn't, so the caller states which direction is good.

export type TrendTone = "positive" | "negative" | "neutral";

/** Percentage-point difference between two points, or null when either side has no data. */
export function computeDelta(current: number | null, previous: number | null): number | null {
  if (current == null || previous == null) return null;
  return Math.round((current - previous) * 100) / 100;
}

/** Which way a delta reads: "positive" (improvement), "negative" (regression), or "neutral"
 *  (no prior point, or no change). `goodDirection` names which raw direction counts as improving
 *  for this particular metric. */
export function deltaTone(delta: number | null, goodDirection: "up" | "down"): TrendTone {
  if (delta == null || delta === 0) return "neutral";
  const isUp = delta > 0;
  const isGood = goodDirection === "up" ? isUp : !isUp;
  return isGood ? "positive" : "negative";
}
