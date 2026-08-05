import type { Freshness } from "@/lib/dashboard/freshness";

const DOT: Record<Freshness["tone"], string> = {
  green: "bg-green-500",
  slate: "bg-gray-400",
  amber: "bg-amber-500",
  red: "bg-red-500",
};

const TEXT: Record<Freshness["tone"], string> = {
  green: "text-muted",
  slate: "text-muted",
  amber: "text-amber-700",
  red: "text-red-700",
};

/** Compact data-freshness indicator ("Updated 12 minutes ago", "data may be stale",
 *  "automatic synchronization is paused") for a page header. English, tone-coded. */
export function FreshnessBadge({ freshness }: { freshness: Freshness }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 text-xs ${TEXT[freshness.tone]}`}
      title="Data freshness reflects the last committed import or Google Sheets sync."
    >
      <span className={`inline-block h-1.5 w-1.5 rounded-full ${DOT[freshness.tone]}`} aria-hidden />
      {freshness.label}
    </span>
  );
}
