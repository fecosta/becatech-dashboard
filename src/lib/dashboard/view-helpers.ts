// Presentation helpers shared by dashboard pages (pure, no I/O).
import { RISK_LEVEL_HEX, RISK_LEVEL_LABEL, RISK_LEVEL_ORDER } from "@/lib/labels";
import type { RiskDistribution } from "./types";

/** Convert a risk distribution into colored chart data (fixed level order). */
export function riskChartData(dist: RiskDistribution) {
  return RISK_LEVEL_ORDER.map((level) => ({
    name: RISK_LEVEL_LABEL[level],
    value: dist[level],
    color: RISK_LEVEL_HEX[level],
  }));
}
