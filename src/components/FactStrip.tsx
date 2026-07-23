// Horizontal row of context numbers (e.g. cohorts, scholars selected, partner
// universities, delivery partners) — reused across Home, Early Support, and
// Growth & Development.
import type { ReactNode } from "react";

export interface FactStripItem {
  value: ReactNode;
  label: ReactNode;
  tone?: "purple" | "green";
  /** e.g. a ProxyBadge, when the fact isn't backed by real data yet. */
  badge?: ReactNode;
}

const TONE_CLASS: Record<"purple" | "green" | "default", string> = {
  purple: "text-purple",
  green: "text-green",
  default: "text-surface-dark",
};

export function FactStrip({ items }: { items: FactStripItem[] }) {
  return (
    <div className="flex divide-x divide-border overflow-hidden rounded-2xl border border-border bg-card">
      {items.map((item, i) => (
        <div key={i} className="flex-1 px-2.5 py-[18px] text-center">
          <div className={`text-2xl font-extrabold ${TONE_CLASS[item.tone ?? "default"]}`}>
            {item.value}
          </div>
          <div className="mt-1 flex items-center justify-center gap-1 text-[11.5px] text-muted">
            <span>{item.label}</span>
            {item.badge}
          </div>
        </div>
      ))}
    </div>
  );
}
