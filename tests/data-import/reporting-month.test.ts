import { describe, expect, it } from "vitest";
import { toReportingMonth } from "@/lib/data-import/validate";

// A mentor report's risk period must be a real YYYY-MM month. The sheet's own "month" field is a
// free-text label ("MES 1"), so the month is derived from the session date instead — these were the
// values that previously corrupted the current-period logic with timestamp-shaped strings.
describe("toReportingMonth", () => {
  const feb = new Date("2026-02-15T00:00:00.000Z");

  it("keeps an already YYYY-MM raw value", () => {
    expect(toReportingMonth("2026-02", feb)).toBe("2026-02");
  });

  it("truncates a YYYY-MM-DD raw value to the month", () => {
    expect(toReportingMonth("2026-02-15", undefined)).toBe("2026-02");
  });

  it("zero-pads a single-digit month", () => {
    expect(toReportingMonth("2026-2", undefined)).toBe("2026-02");
  });

  it("ignores the 'MES n' label and falls back to the session date's month", () => {
    expect(toReportingMonth("MES 1", feb)).toBe("2026-02");
  });

  it("derives the month from the session date when there is no raw value", () => {
    expect(toReportingMonth(undefined, feb)).toBe("2026-02");
    expect(toReportingMonth("", feb)).toBe("2026-02");
  });

  it("returns undefined when neither a monthy label nor a session date is usable", () => {
    expect(toReportingMonth("MES 1", undefined)).toBeUndefined();
    expect(toReportingMonth(undefined, undefined)).toBeUndefined();
    expect(toReportingMonth("Mes 1", new Date("not-a-date"))).toBeUndefined();
  });

  it("uses UTC so a session date does not slip to an adjacent month", () => {
    // 2026-03-01T00:00 UTC must read as March, never February in a negative-offset locale.
    expect(toReportingMonth(undefined, new Date("2026-03-01T00:00:00.000Z"))).toBe("2026-03");
  });
});
