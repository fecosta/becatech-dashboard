// Per-university retention row ("All Universities — Retention & Drop Out Rate") — a stacked bar of
// % retained (green) and % dropped out (red), with the two percentages labelled at the end.
export interface UniRetentionDatum {
  name: string;
  retentionPct: number; // 0-100
  dropOutPct: number; // 0-100
}

export function UniversityRetentionList({ data }: { data: UniRetentionDatum[] }) {
  return (
    <div>
      {data.map((d) => (
        <div
          key={d.name}
          className="flex items-center gap-3.5 border-b border-border py-2.5 last:border-b-0"
        >
          <div className="w-[220px] flex-shrink-0 text-[12.5px] font-semibold text-surface-dark">
            {d.name}
          </div>
          <div className="flex h-[11px] flex-1 overflow-hidden rounded-full bg-track">
            <div className="h-full bg-green" style={{ width: `${d.retentionPct}%` }} />
            <div className="h-full bg-[#d33636]" style={{ width: `${d.dropOutPct}%` }} />
          </div>
          <div className="w-[84px] flex-shrink-0 text-right text-[11.5px] font-bold text-surface-dark">
            {d.retentionPct}% · {d.dropOutPct}%
          </div>
        </div>
      ))}
      <div className="mt-4 text-xs text-muted">
        Retention % · Drop out % — shown per university, all cohorts combined.
      </div>
    </div>
  );
}
