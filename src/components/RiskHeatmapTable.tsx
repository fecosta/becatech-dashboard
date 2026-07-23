// Monthly follow-up heatmap (Scholar Progress) — one row per period, one risk-colored
// cell per dimension. CRITICO gets the mockup's solid black+yellow treatment; the other
// four levels use a light tint of their own RISK_LEVEL_HEX_SEGMENTED color.
import type { RiskLevel } from "@/generated/prisma/enums";
import { RISK_LEVEL_HEX_SEGMENTED, RISK_LEVEL_LABEL } from "@/lib/labels";

export interface RiskHeatmapRow {
  period: string;
  academic: RiskLevel;
  psychosocial: RiskLevel;
  global: RiskLevel;
}

// RIESGO_BAJO's segmented hex (#8fe0b4) is too pale to read as text at full opacity —
// use the mockup's own darker "low" risk-cell text color instead; background tint still
// derives from the real segmented hex so the row still reads as part of the same scale.
const TEXT_COLOR_OVERRIDE: Partial<Record<RiskLevel, string>> = {
  RIESGO_BAJO: "#3fa968",
};

function RiskCell({ level }: { level: RiskLevel }) {
  if (level === "CRITICO") {
    return (
      <span className="inline-block rounded-lg bg-surface-dark px-2.5 py-1 text-[11.5px] font-bold text-yellow">
        {RISK_LEVEL_LABEL[level]}
      </span>
    );
  }
  const hex = RISK_LEVEL_HEX_SEGMENTED[level];
  return (
    <span
      className="inline-block rounded-lg px-2.5 py-1 text-[11.5px] font-bold"
      style={{ backgroundColor: `${hex}26`, color: TEXT_COLOR_OVERRIDE[level] ?? hex }}
    >
      {RISK_LEVEL_LABEL[level]}
    </span>
  );
}

const TH = "pb-1.5 text-[11px] font-bold uppercase tracking-[0.03em] text-muted";

export function RiskHeatmapTable({ rows }: { rows: RiskHeatmapRow[] }) {
  if (rows.length === 0) {
    return <p className="text-sm text-muted">No monthly risk history on record.</p>;
  }
  return (
    <table className="w-full border-separate border-spacing-y-1.5 text-[12.5px]">
      <thead>
        <tr>
          <th className={`${TH} text-left`}>Month</th>
          <th className={`${TH} text-center`}>Academic</th>
          <th className={`${TH} text-center`}>Psychosocial</th>
          <th className={`${TH} text-center`}>Global</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.period}>
            <td className="py-1 pr-2 font-semibold text-surface-dark">{r.period}</td>
            <td className="py-1 text-center">
              <RiskCell level={r.academic} />
            </td>
            <td className="py-1 text-center">
              <RiskCell level={r.psychosocial} />
            </td>
            <td className="py-1 text-center">
              <RiskCell level={r.global} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
