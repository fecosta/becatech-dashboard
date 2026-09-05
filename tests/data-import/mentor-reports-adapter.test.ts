// Tests the formalized SourceAdapter (adapters/mentor-reports.ts) against a realistic, synthetic
// fixture: a decorative title + summary row above the real header, with GLOBAL STATUS placed
// *before* the identity columns to prove column position isn't relied on. All scholar/mentor
// names and IDs are fictional.
import { readFileSync } from "node:fs";
import path from "node:path";
import * as XLSX from "xlsx";
import { describe, expect, it } from "vitest";
import { mentorReportsAdapter } from "@/lib/data-import/adapters/mentor-reports";
import type { ParsedSheet } from "@/lib/data-import/parse";
import { parseWorkbook } from "@/lib/data-import/parse";

function loadFixtureSheet(): ParsedSheet {
  const buf = readFileSync(path.join(__dirname, "../fixtures/mentor-reports.csv"));
  return parseWorkbook(buf)[0];
}

/** Header-detection needs the raw `sheet.sheet` worksheet (positional scan below any decorative
 *  rows), not just header-keyed `records` — build both, same as parseWorkbook does. */
function buildSheet(aoa: unknown[][]): ParsedSheet {
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  const records = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, {
    defval: null,
    raw: true,
    blankrows: false,
  });
  return { sheetName: "MENTOR REPORTS", sheet: ws, records };
}

describe("mentorReportsAdapter (fixture)", () => {
  it("detects the sheet past the decorative title/summary rows above the real header", () => {
    expect(mentorReportsAdapter.canHandle(loadFixtureSheet())).toBe(true);
  });

  it("passes GLOBAL STATUS through verbatim for every risk level, never re-deriving it", () => {
    const batch = mentorReportsAdapter.adapt(loadFixtureSheet());
    const byScholar = new Map((batch.MENTOR_REPORT ?? []).map((r) => [r.data.scholarId, r.data]));
    expect(byScholar.get("BT-CO-101")?.mentorReportedGlobalStatus).toBe("Sin riesgo");
    expect(byScholar.get("BT-CO-102")?.mentorReportedGlobalStatus).toBe("Riesgo bajo");
    expect(byScholar.get("BT-PE-201")?.mentorReportedGlobalStatus).toBe("Riesgo medio");
    expect(byScholar.get("BT-PE-202")?.mentorReportedGlobalStatus).toBe("Riesgo alto");
    expect(byScholar.get("BT-CO-103")?.mentorReportedGlobalStatus).toBe("Riesgo crítico");
  });

  it("maps identity, submission id, and program-month/semester fields verbatim", () => {
    const batch = mentorReportsAdapter.adapt(loadFixtureSheet());
    const first = (batch.MENTOR_REPORT ?? []).find((r) => r.data.scholarId === "BT-CO-101");
    expect(first?.data.submissionId).toBe("sub-fx-001");
    expect(first?.data.scholarName).toBe("Ana Fictional Uno");
    expect(first?.data.semester).toBe("2026-1");
    expect(first?.data.reportingMonth).toBe("MES 6");
    expect(first?.data.country).toBe("COLOMBIA");
  });

  it("leaves reportingMonth to the session-date fallback when the label column is blank", () => {
    const batch = mentorReportsAdapter.adapt(loadFixtureSheet());
    const second = (batch.MENTOR_REPORT ?? []).find((r) => r.data.scholarId === "BT-CO-102");
    // The fixture's "¿Qué mes reportas?" cell is blank for this row — the adapter itself passes
    // that through as-is (undefined); reportingMonthFor()'s session-date fallback is validate.ts's
    // job (see tests/data-import/reporting-month.test.ts), not this adapter's.
    expect(second?.data.reportingMonth).toBeFalsy();
    expect(second?.data.sessionDate).toBeInstanceOf(Date);
  });

  it("classifies the header: an unrelated new column warns, a known-ignored column doesn't, identity is recognized", () => {
    const report = mentorReportsAdapter.inspectSchema!(loadFixtureSheet());
    expect(report.unknown).toContain("favorite color");
    expect(report.ignored).toContain("mentor id");
    expect(report.unknown).not.toContain("mentor id");
    expect(report.missingRequired).toEqual([]);
  });

  it("tolerates a fully reordered header (GLOBAL STATUS and SUBMISSION ID after the free-text fields)", () => {
    const header = [
      "MODALIDAD DEL ESPACIO",
      "ACADEMIC STATUS",
      "ID OF THE SCHOLAR",
      "SCHOLAR'S NAME",
      "GLOBAL STATUS",
      "SUBMISSION ID",
    ];
    const row = ["Virtual", "Bueno", "BT-CO-950", "Reordered Fictional Scholar", "Riesgo bajo", "sub-fx-reorder-1"];
    const sheet = buildSheet([header, row]);
    expect(mentorReportsAdapter.canHandle(sheet)).toBe(true);
    const batch = mentorReportsAdapter.adapt(sheet);
    expect(batch.MENTOR_REPORT?.[0].data.scholarId).toBe("BT-CO-950");
    expect(batch.MENTOR_REPORT?.[0].data.mentorReportedGlobalStatus).toBe("Riesgo bajo");
  });

  it("maps the live sheet's actual mistyped headers (SCHOLAR'NAME, MENTOR' S NAME)", () => {
    // Confirmed from a real production Mentor Reports export: the intended "Scholar's Name" /
    // "Mentor's Name" headers are actually "SCHOLAR'NAME" (missing the S, no space) and
    // "MENTOR' S NAME" (stray space before the S). Without these aliases, scholarName comes
    // through blank, which cascades into "scholarId does not exist" for every row whose direct ID
    // doesn't independently match an already-imported Scholar.
    const header = ["ID OF THE SCHOLAR", "SCHOLAR'NAME", "MENTOR' S NAME", "GLOBAL STATUS", "SUBMISSION ID"];
    const row = ["61145519", "Real Sheet Fictional Scholar", "Real Sheet Fictional Mentor", "Riesgo bajo", "sub-fx-typo-1"];
    const sheet = buildSheet([header, row]);
    expect(mentorReportsAdapter.canHandle(sheet)).toBe(true);
    const batch = mentorReportsAdapter.adapt(sheet);
    expect(batch.MENTOR_REPORT?.[0].data.scholarName).toBe("Real Sheet Fictional Scholar");
    expect(batch.MENTOR_REPORT?.[0].data.mentorName).toBe("Real Sheet Fictional Mentor");

    const report = mentorReportsAdapter.inspectSchema!(sheet);
    expect(report.missingRequired).toEqual([]);
    expect(report.unknown).toEqual([]);
  });
});
