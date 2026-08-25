// Risk bands for the ranked per-university bars in AUGUST 4. The design colours each
// bar by which band it falls in and prints the thresholds as a legend, so the
// thresholds have to live in one place the legend can also read.

export type RiskBand = "low" | "medium" | "high";

export const DROPOUT_BAND_LEGEND = [
  { band: "low" as const, label: "Low risk · dropout 0–4%" },
  { band: "medium" as const, label: "Medium risk · dropout 5–7%" },
  { band: "high" as const, label: "High risk · dropout 8%+" },
];

/** Band for a university's dropout percentage (0–100). Home §7. */
export function dropoutBand(dropOutPct: number): RiskBand {
  if (dropOutPct >= 8) return "high";
  if (dropOutPct >= 5) return "medium";
  return "low";
}

export const AT_RISK_BAND_LEGEND = [
  { band: "low" as const, label: "Low risk · 0–27%" },
  { band: "medium" as const, label: "Medium risk · 28–33%" },
  { band: "high" as const, label: "High risk · 34%+" },
];

/** Band for the share of a university's scholars at Medium+ risk (0–100). Early Support §2.4. */
export function atRiskBand(atRiskPct: number): RiskBand {
  if (atRiskPct >= 34) return "high";
  if (atRiskPct >= 28) return "medium";
  return "low";
}

export const BAND_HEX: Record<RiskBand, string> = {
  low: "#27cf77",
  medium: "#c9d400",
  high: "#d33636",
};
