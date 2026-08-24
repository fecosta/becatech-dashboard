// Operating-partner rows (Program Ecosystem). AUGUST 4 groups these by country and
// carries the track as a badge on each row, inverting the previous grouping — the
// question the page answers is "who delivers this, where", and the track is an
// attribute of the partner rather than the top-level split.
import type { Country, OperatorTrack } from "@/generated/prisma/enums";
import { TypeBadge } from "@/components/ui";

export interface DeliveryPartnerRow {
  name: string;
  country: Country;
  track: OperatorTrack;
  scholarCount: number;
}

const TRACK_LABEL: Record<OperatorTrack, string> = {
  EARLY_SUPPORT: "Early Support",
  GROWTH_DEVELOPMENT: "Growth & Development",
};

export function DeliveryPartnerGroup({ operators }: { operators: DeliveryPartnerRow[] }) {
  return (
    <div className="px-5">
      {operators.map((o) => (
        <div
          key={o.name}
          className="flex items-start justify-between gap-3 border-b border-border py-2.5 last:border-b-0"
        >
          <div className="text-[13.5px] font-semibold text-surface-dark">
            {o.name}
            <TypeBadge tone={o.track === "EARLY_SUPPORT" ? "lavender" : "mint"}>
              {TRACK_LABEL[o.track]}
            </TypeBadge>
          </div>
          <div
            className={`shrink-0 text-sm font-extrabold ${
              o.track === "EARLY_SUPPORT" ? "text-purple" : "text-green"
            }`}
          >
            {o.scholarCount} <span className="text-[11.5px] font-normal text-muted">scholars</span>
          </div>
        </div>
      ))}
    </div>
  );
}
