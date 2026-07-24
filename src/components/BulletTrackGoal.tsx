// Single goal-vs-actual row (label, current value, optional goal marker, filled
// track) — reused by Home's Retention Rate panel (no goal marker, per the decision not
// to fabricate unconfirmed targets) and Growth & Development's Professional Skills
// panel (goal shape shown, values pending real data).
import { ProxyBadge } from "@/components/ui";

export function BulletTrackGoal({
  label,
  goalLabel,
  valueLabel,
  fillPct,
  goalPct,
  pending = false,
}: {
  label: string;
  /** e.g. "goal ≥85%" — shown next to the label when a goal exists. */
  goalLabel?: string;
  /** Displayed current-value text, e.g. "89%" or "7.6/10". Ignored when pending. */
  valueLabel?: string;
  /** 0–100 — width of the filled track. Ignored when pending. */
  fillPct?: number;
  /** 0–100 — position of the goal marker tick. */
  goalPct?: number;
  /** Render a dashed empty track + PENDING badge instead of a value (no fabricated data). */
  pending?: boolean;
}) {
  const belowGoal = !pending && goalPct != null && fillPct != null && fillPct < goalPct;
  const fillColor = belowGoal ? "bg-purple" : "bg-green";

  return (
    <div className="mb-3.5 last:mb-0">
      <div className="mb-1 flex justify-between text-xs text-ink">
        <span>
          {label}
          {goalLabel ? <span className="text-muted"> · {goalLabel}</span> : null}
        </span>
        {pending ? (
          <ProxyBadge>PENDING</ProxyBadge>
        ) : (
          <span className="font-bold">{valueLabel}</span>
        )}
      </div>
      <div className="relative h-[11px] rounded-full bg-track">
        {!pending && fillPct != null ? (
          <div
            className={`h-full rounded-full ${fillColor}`}
            style={{ width: `${Math.max(0, Math.min(100, fillPct))}%` }}
          />
        ) : null}
        {goalPct != null ? (
          <div
            className="absolute -top-[3px] h-[17px] w-0.5 bg-surface-dark"
            style={{ left: `${Math.max(0, Math.min(100, goalPct))}%` }}
          />
        ) : null}
      </div>
    </div>
  );
}
