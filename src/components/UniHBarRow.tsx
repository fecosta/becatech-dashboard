// Per-university horizontal bar row ("Scholars Status per University") — bar width =
// % low risk (SIN_RIESGO + RIESGO_BAJO), the remainder needs attention.
import { COUNTRY_ABBR, COUNTRY_LABEL } from "@/lib/labels";
import type { Country } from "@/generated/prisma/enums";

export interface UniHBarDatum {
  name: string;
  /** Optional country tag (shown for universities; omitted for city/gender/socioeconomic rows). */
  country?: Country;
  lowRiskPct: number; // 0-1
}

export function UniHBarRow({ data, hideLegend = false }: { data: UniHBarDatum[]; hideLegend?: boolean }) {
  return (
    <div>
      {data.map((d) => {
        const pct = Math.round(d.lowRiskPct * 100);
        return (
          <div
            key={d.name}
            className="flex items-center gap-3.5 border-b border-border py-2.5 last:border-b-0"
          >
            <div className="w-[250px] flex-shrink-0 text-[12.5px] font-semibold text-surface-dark">
              {d.name}
              {d.country ? (
                <>
                  {" "}
                  <span className="font-normal text-muted" title={COUNTRY_LABEL[d.country]}>
                    {COUNTRY_ABBR[d.country]}
                  </span>
                </>
              ) : null}
            </div>
            <div className="h-[18px] flex-1 rounded-full bg-track">
              <div
                className="flex h-full min-w-[34px] items-center justify-end rounded-full bg-green px-2.5"
                style={{ width: `${Math.max(0, Math.min(100, pct))}%` }}
              >
                <span className="text-[11px] font-bold text-white">{pct}%</span>
              </div>
            </div>
          </div>
        );
      })}
      {hideLegend ? null : (
        <div className="mt-4 flex flex-wrap gap-3.5 text-xs text-ink">
          <span className="inline-flex items-center gap-1.5">
            <i className="inline-block h-2.5 w-2.5 rounded-full bg-green" />
            Bar = % Low risk (No Risk + Low)
          </span>
          <span className="text-muted">Remaining % = Needs attention (Medium + High + Critical)</span>
        </div>
      )}
    </div>
  );
}
