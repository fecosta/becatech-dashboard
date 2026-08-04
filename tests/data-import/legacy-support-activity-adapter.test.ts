import * as XLSX from "xlsx";
import { describe, expect, it } from "vitest";
import {
  isSupportActivityLogSheet,
  supportActivityLogLegacyAdapter,
} from "@/lib/data-import/adapters/legacy-support-activity";
import type { ParsedSheet } from "@/lib/data-import/parse";
import type { ValidationContext } from "@/lib/data-import/types";
import { validateBatch } from "@/lib/data-import/validate";

// Identity block (10 cols) matches the real tab: ID, PAÍS, NOMBRE BECARIO(A), MENTOR(A), ID
// (mentor id), COHORTE, UNIVERSIDAD, CARRERA, SEMESTRE, ESTADO EN EL PROGRAMA. Followed here by
// three repeating "MES" blocks (real sheet has 6) — enough to prove position-relative bucketing
// works regardless of block count, including a block with a blank MES (should be skipped).
const IDENTITY = ["ID", "PAÍS", "NOMBRE BECARIO(A)", "MENTOR(A)", "ID", "COHORTE", "UNIVERSIDAD", "CARRERA", "SEMESTRE", "ESTADO EN EL PROGRAMA"];
const BLOCK = ["MES", "Tutorías IND", "Tutorías GRUP", "Mentorías IND", "Mentorías GRUP", "Talleres", "Participación en estrategias"];

const SUB_HEADER = [...IDENTITY, ...BLOCK, ...BLOCK, ...BLOCK];
const BLOCK_LABELS = new Array(SUB_HEADER.length).fill("");

function buildSheet(subHeaderRow: unknown[], dataRows: unknown[][]): ParsedSheet {
  const aoa = [BLOCK_LABELS, subHeaderRow, ...dataRows];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  const records = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, {
    defval: null,
    raw: true,
    blankrows: false,
  });
  return { sheetName: "SUPPORT ACTIVITY LOG", sheet: ws, records };
}

function identityValues(scholarId: string): unknown[] {
  return [scholarId, "Colombia", "Ana Pérez", "Mentor X", "MENTOR-1", "2025", "Universidad Nacional de Colombia", "CS", 3, "Activo"];
}

describe("support-activity-log legacy adapter", () => {
  it("detects a support-activity-log sheet", () => {
    expect(isSupportActivityLogSheet(buildSheet(SUB_HEADER, []))).toBe(true);
    expect(isSupportActivityLogSheet(buildSheet(["ID", "foo", "bar"], []))).toBe(false);
  });

  it("pivots each month block into per-activityType rows, sourcing period from that block's MES cell", () => {
    const row = [
      ...identityValues("BT-CO-001"),
      "2026-01", 2, 1, 0, 0, 1, "bien", // block 1
      "2026-02", 3, 0, 1, 0, 2, "bien2", // block 2
      "", 5, 5, 5, 5, 5, "should be skipped — MES blank", // block 3 (not yet happened)
    ];
    const rows = supportActivityLogLegacyAdapter(buildSheet(SUB_HEADER, [row]));

    // 2 non-blank months × 5 activity types = 10 rows; block 3 (blank MES) contributes none.
    expect(rows).toHaveLength(10);
    expect(rows.every((r) => r.data.scholarId === "BT-CO-001")).toBe(true);
    expect(rows.every((r) => r.data.country === "COLOMBIA")).toBe(true);
    expect(rows.every((r) => r.data.cohort === "2025")).toBe(true);
    expect(rows.every((r) => r.data.source === "google-sheets-sync")).toBe(true);

    const jan = rows.filter((r) => r.data.period === "2026-01");
    expect(jan).toHaveLength(5);
    const byType = Object.fromEntries(jan.map((r) => [r.data.activityType, r.data.activityCount]));
    expect(byType.INDIVIDUAL_TUTORING).toBe(2);
    expect(byType.GROUP_TUTORING).toBe(1);
    expect(byType.INDIVIDUAL_MENTORING).toBe(0);
    expect(byType.GROUP_MENTORING).toBe(0);
    expect(byType.WORKSHOP).toBe(1);

    const feb = rows.filter((r) => r.data.period === "2026-02");
    expect(feb).toHaveLength(5);
    const febByType = Object.fromEntries(feb.map((r) => [r.data.activityType, r.data.activityCount]));
    expect(febByType.INDIVIDUAL_TUTORING).toBe(3);
    expect(febByType.INDIVIDUAL_MENTORING).toBe(1);

    expect(rows.some((r) => r.data.period === "")).toBe(false);
  });

  it("skips blank scholar rows", () => {
    const blank = new Array(SUB_HEADER.length).fill(null);
    const rows = supportActivityLogLegacyAdapter(buildSheet(SUB_HEADER, [blank]));
    expect(rows).toHaveLength(0);
  });

  it("produces rows that pass validation", () => {
    const row = [...identityValues("BT-CO-001"), "2026-01", 2, 1, 0, 0, 1, "bien", "", 0, 0, 0, 0, 0, "", "", 0, 0, 0, 0, 0, ""];
    const batch = { SUPPORT_ACTIVITY: supportActivityLogLegacyAdapter(buildSheet(SUB_HEADER, [row])) };
    const ctx: ValidationContext = {
      existingScholarIds: new Set(["BT-CO-001"]),
      scholarIdsByNormalizedName: new Map(),
      countryByScholarId: new Map(),
      controls: new Map<string, Set<string>>([
        ["country", new Set(["COLOMBIA", "PERU"])],
        [
          "activity_type",
          new Set(["INDIVIDUAL_TUTORING", "GROUP_TUTORING", "INDIVIDUAL_MENTORING", "GROUP_MENTORING", "WORKSHOP"]),
        ],
      ]),
      universities: new Map(),
      operatorsByName: new Map(),
    };
    const res = validateBatch(batch, ctx);
    expect(res.errorRows).toBe(0);
    expect(res.validated.SUPPORT_ACTIVITY).toHaveLength(5);
  });
});
