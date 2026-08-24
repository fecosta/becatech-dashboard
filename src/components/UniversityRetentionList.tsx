// Ranked per-university retention ("Retention & Dropout Rate by University").
//
// AUGUST 4 orders these worst dropout first, so the universities needing attention sit
// at the top, and colours the retained segment by which dropout band the university
// falls in. The remaining grey segment is the dropout share.
import type { Country } from "@/generated/prisma/enums";
import { BAND_HEX, DROPOUT_BAND_LEGEND, type RiskBand } from "@/lib/dashboard/bands";
import { COUNTRY_ABBR } from "@/lib/labels";

export interface UniRetentionDatum {
  name: string;
  country?: Country;
  retentionPct: number; // 0-100
  dropOutPct: number; // 0-100
  band: RiskBand;
}

export function UniversityRetentionList({ data }: { data: UniRetentionDatum[] }) {
  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-3.5 text-xs text-ink">
        {DROPOUT_BAND_LEGEND.map((l) => (
          <span key={l.band} className="inline-flex items-center gap-1.5">
            <i
              className="inline-block h-[9px] w-[9px] rounded-full"
              style={{ backgroundColor: BAND_HEX[l.band] }}
            />
            {l.label}
          </span>
        ))}
      </div>
      {data.map((d) => (
        <div
          key={d.name}
          className="flex items-center gap-3.5 border-b border-border py-2.5 last:border-b-0"
        >
          <div className="w-[250px] flex-shrink-0 text-[12.5px] font-semibold text-surface-dark">
            {d.name}
            {d.country ? (
              <span className="ml-1.5 text-[11px] font-normal text-muted">
                {COUNTRY_ABBR[d.country]}
              </span>
            ) : null}
          </div>
          <div className="flex h-3 flex-1 overflow-hidden rounded-full bg-track">
            <div
              className="h-full"
              style={{ width: `${d.retentionPct}%`, backgroundColor: BAND_HEX[d.band] }}
            />
          </div>
          <div className="w-[112px] flex-shrink-0 text-right text-[11.5px] font-bold text-surface-dark">
            {d.retentionPct}% · {d.dropOutPct}%
          </div>
        </div>
      ))}
      <div className="mt-4 text-xs text-muted">
        Ranked by dropout, highest first. Bar colour is the dropout band; the grey remainder is the
        dropout share. Retention % · Dropout %, all cohorts combined.
      </div>
    </div>
  );
}
