import { describe, expect, it } from "vitest";
import { reportingMonthFor } from "@/lib/data-import/validate";

// On the live sheet the "¿Qué mes reportas?" column is usually blank; the session date is always
// set. Without the session-date fallback, reportingMonth is null and the report keys no risk.
describe("reportingMonthFor", () => {
  it("uses the reported-month label when present", () => {
    expect(reportingMonthFor("MES 3", new Date("2026-05-10T00:00:00Z"))).toBe("MES 3");
    expect(reportingMonthFor("2026-03", undefined)).toBe("2026-03");
    expect(reportingMonthFor("  MES 2 ", undefined)).toBe("MES 2");
  });

  it("falls back to the session date's YYYY-MM when the label is blank", () => {
    expect(reportingMonthFor("", new Date("2026-03-15T00:00:00Z"))).toBe("2026-03");
    expect(reportingMonthFor("   ", new Date("2026-04-01T00:00:00Z"))).toBe("2026-04");
    expect(reportingMonthFor(undefined, new Date("2026-12-31T00:00:00Z"))).toBe("2026-12");
  });

  it("returns undefined when neither is usable", () => {
    expect(reportingMonthFor(undefined, undefined)).toBeUndefined();
    expect(reportingMonthFor("", new Date("not-a-date"))).toBeUndefined();
  });
});
