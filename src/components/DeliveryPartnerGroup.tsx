// Grouped delivery-partner list (Program Ecosystem) — one group per operator track.
import type { Country } from "@/generated/prisma/enums";
import { ProxyBadge } from "@/components/ui";
import { COUNTRY_LABEL } from "@/lib/labels";

export interface DeliveryPartnerRow {
  name: string;
  country: Country;
  scholarCount: number;
}

export function DeliveryPartnerGroup({
  title,
  operators,
}: {
  title: string;
  operators: DeliveryPartnerRow[];
}) {
  return (
    <div className="mt-4 first:mt-0">
      <div className="mb-2 text-xs font-bold uppercase tracking-[0.03em] text-purple">{title}</div>
      {operators.map((o) => (
        <div
          key={o.name}
          className="flex items-center justify-between border-b border-border py-2.5 last:border-b-0"
        >
          <div className="text-[13.5px] font-semibold text-surface-dark">
            {o.name}
            <span className="ml-1.5 text-[11.5px] font-normal text-muted">
              {COUNTRY_LABEL[o.country]}
            </span>
          </div>
          <div className="text-sm font-extrabold text-surface-dark">
            {o.scholarCount} <span className="text-[11.5px] font-normal text-muted">scholars</span>
          </div>
        </div>
      ))}
      <div className="mt-2 flex items-center gap-1.5 text-xs text-muted">
        Survey results <ProxyBadge>PENDING</ProxyBadge>
      </div>
    </div>
  );
}
