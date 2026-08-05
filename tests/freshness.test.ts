import { describe, expect, it } from "vitest";
import { describeFreshness, formatRelativeTime } from "@/lib/dashboard/freshness";

const at = (iso: string) => new Date(iso);

describe("formatRelativeTime", () => {
  const now = at("2026-08-05T12:00:00Z");
  it("renders English, singular/plural aware, coarsening by unit", () => {
    expect(formatRelativeTime(at("2026-08-05T11:59:30Z"), now)).toBe("just now");
    expect(formatRelativeTime(at("2026-08-05T11:59:00Z"), now)).toBe("1 minute ago");
    expect(formatRelativeTime(at("2026-08-05T11:48:00Z"), now)).toBe("12 minutes ago");
    expect(formatRelativeTime(at("2026-08-05T09:00:00Z"), now)).toBe("3 hours ago");
    expect(formatRelativeTime(at("2026-08-03T12:00:00Z"), now)).toBe("2 days ago");
  });

  it("never renders a negative/future duration", () => {
    expect(formatRelativeTime(at("2026-08-05T12:05:00Z"), now)).toBe("just now");
  });
});

describe("describeFreshness", () => {
  const now = at("2026-08-05T12:00:00Z");

  it("fresh data → green 'Updated N ago'", () => {
    const f = describeFreshness(at("2026-08-05T11:48:00Z"), now);
    expect(f).toMatchObject({ label: "Updated 12 minutes ago", tone: "green", stale: false });
  });

  it("old data → amber 'may be stale'", () => {
    const f = describeFreshness(at("2026-08-03T12:00:00Z"), now); // 48h ago, default threshold 24h
    expect(f.stale).toBe(true);
    expect(f.tone).toBe("amber");
    expect(f.label).toMatch(/data may be stale/);
  });

  it("paused takes precedence and is always surfaced", () => {
    const f = describeFreshness(at("2026-08-05T11:48:00Z"), now, { automationPaused: true });
    expect(f.paused).toBe(true);
    expect(f.label).toMatch(/automatic synchronization is paused/);
  });

  it("no data yet → amber, stale, honest empty state", () => {
    const f = describeFreshness(null, now);
    expect(f).toMatchObject({ label: "No data synced yet", tone: "amber", stale: true });
  });

  it("respects a custom staleness threshold", () => {
    const twoHoursAgo = at("2026-08-05T10:00:00Z");
    expect(describeFreshness(twoHoursAgo, now, { stalenessHours: 1 }).stale).toBe(true);
    expect(describeFreshness(twoHoursAgo, now, { stalenessHours: 6 }).stale).toBe(false);
  });
});
