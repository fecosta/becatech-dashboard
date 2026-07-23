// Captioned column chart (value-on-top, colored bar, label, optional muted note) — the
// shape used by Home's Academic Progress / Scholars-by-Year bars, and Early
// Support / Growth & Development's on-track-vs-behind bars. Not a Recharts chart: no
// axis or tooltip in the mockup, just fixed captions under each bar.
export interface PaceBarDatum {
  label: string;
  note?: string;
  valueLabel: string;
  /** 0–100 — height of the bar, as a % of the fixed bar-area height. */
  heightPct: number;
  color: string;
}

export function PaceBarChart({
  data,
  barAreaPx = 120,
  barWidthPx = 44,
}: {
  data: PaceBarDatum[];
  /** Fixed pixel height of the bar area (bars bottom-align within it). */
  barAreaPx?: number;
  barWidthPx?: number;
}) {
  return (
    <div className="flex items-end gap-5 pt-2.5">
      {data.map((d, i) => (
        <div key={i} className="flex flex-col items-center gap-2" style={{ width: barWidthPx + 34 }}>
          <div className="text-[13px] font-extrabold text-surface-dark">{d.valueLabel}</div>
          <div className="flex items-end" style={{ height: barAreaPx, width: barWidthPx }}>
            <div
              className="w-full rounded-t-lg"
              style={{
                height: `${Math.max(2, Math.min(100, d.heightPct))}%`,
                backgroundColor: d.color,
              }}
            />
          </div>
          <div className="text-center text-[11.5px] text-muted">{d.label}</div>
          {d.note ? (
            <div className="max-w-[90px] text-center text-[10.5px] leading-tight text-muted">
              {d.note}
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
}
