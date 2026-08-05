// Data-freshness signals for the dashboard. Answers "how current is what I'm looking at?" from the
// last committed import/sync, and surfaces two operational states in plain English: data may be
// stale, or automatic synchronization is paused. This module is PURE (no DB import) so it is
// deterministic and unit-testable — the caller passes `now`; the DB read (getFreshness) lives in
// the query layer (queries.ts).
export type FreshnessTone = "green" | "slate" | "amber" | "red";

export interface Freshness {
  label: string;
  tone: FreshnessTone;
  /** True when the data is older than the staleness threshold, or nothing has synced yet. */
  stale: boolean;
  /** True when automatic synchronization is paused (an operational state, see syncAutomationPaused). */
  paused: boolean;
}

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** "just now" / "12 minutes ago" / "3 hours ago" / "2 days ago" — English, singular/plural aware. */
export function formatRelativeTime(from: Date, now: Date): string {
  const ms = Math.max(0, now.getTime() - from.getTime());
  if (ms < MINUTE) return "just now";
  const plural = (n: number, unit: string) => `${n} ${unit}${n === 1 ? "" : "s"} ago`;
  if (ms < HOUR) return plural(Math.floor(ms / MINUTE), "minute");
  if (ms < DAY) return plural(Math.floor(ms / HOUR), "hour");
  return plural(Math.floor(ms / DAY), "day");
}

/**
 * Whether the automatic Google Sheets sync is currently paused. Driven by an env flag because the
 * trigger's on/off state lives in Apps Script, not the app — set SYNC_AUTOMATION_PAUSED=true while
 * the 15-minute trigger is intentionally disabled so the UI can say so honestly. Defaults to false
 * (not shown) when unset, rather than guessing.
 */
export function syncAutomationPaused(): boolean {
  return process.env.SYNC_AUTOMATION_PAUSED === "true";
}

/**
 * Build the freshness label from the last-updated timestamp. `automationPaused` takes precedence
 * (it's the most actionable state); otherwise data older than `stalenessHours` (default 24h) is
 * flagged "may be stale". Null timestamp → "No data synced yet".
 */
export function describeFreshness(
  lastUpdatedAt: Date | null,
  now: Date,
  opts: { stalenessHours?: number; automationPaused?: boolean } = {},
): Freshness {
  const paused = opts.automationPaused ?? false;
  const stalenessMs = (opts.stalenessHours ?? 24) * HOUR;

  if (!lastUpdatedAt) {
    return {
      label: paused ? "No data synced yet · automatic synchronization is paused" : "No data synced yet",
      tone: "amber",
      stale: true,
      paused,
    };
  }

  const rel = formatRelativeTime(lastUpdatedAt, now);
  const stale = now.getTime() - lastUpdatedAt.getTime() > stalenessMs;

  if (paused) {
    return { label: `Updated ${rel} · automatic synchronization is paused`, tone: "amber", stale, paused };
  }
  if (stale) {
    return { label: `Updated ${rel} · data may be stale`, tone: "amber", stale: true, paused };
  }
  return { label: `Updated ${rel}`, tone: "green", stale: false, paused };
}
