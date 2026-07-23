// Single horizontal 5-segment risk bar + legend (No Risk → Critical), matching the
// Beca Tech+ prototype. Uses the segmented risk palette from globals.css (--risk-*),
// which deliberately differs from the semantic RiskBadge pill colors used in tables.
import type { RiskLevel } from "@/generated/prisma/enums";
import { RISK_LEVEL_LABEL, RISK_LEVEL_ORDER } from "@/lib/labels";
import type { RiskDistribution } from "@/lib/dashboard/types";

const RISK_BAR_VAR: Record<RiskLevel, string> = {
  SIN_RIESGO: "var(--risk-none)",
  RIESGO_BAJO: "var(--risk-low)",
  RIESGO_MEDIO: "var(--risk-medium)",
  RIESGO_ALTO: "var(--risk-high)",
  CRITICO: "var(--risk-critical)",
};

export function RiskBar({ distribution }: { distribution: RiskDistribution }) {
  const total = RISK_LEVEL_ORDER.reduce((sum, level) => sum + distribution[level], 0);

  if (total === 0) {
    return <p className="text-sm text-muted">No risk data for the current selection.</p>;
  }

  const pct = (n: number) => (n / total) * 100;

  return (
    <div>
      <div className="my-3 flex h-3.5 overflow-hidden rounded-full">
        {RISK_LEVEL_ORDER.map((level) =>
          distribution[level] > 0 ? (
            <div
              key={level}
              style={{ width: `${pct(distribution[level])}%`, background: RISK_BAR_VAR[level] }}
            />
          ) : null,
        )}
      </div>
      <div className="flex flex-wrap gap-x-3.5 gap-y-1.5 text-xs text-ink">
        {RISK_LEVEL_ORDER.map((level) => (
          <span key={level} className="inline-flex items-center gap-1.5">
            <i
              className="inline-block h-2.5 w-2.5 rounded-full"
              style={{ background: RISK_BAR_VAR[level] }}
            />
            {RISK_LEVEL_LABEL[level]} · {Math.round(pct(distribution[level]))}%
          </span>
        ))}
      </div>
    </div>
  );
}
