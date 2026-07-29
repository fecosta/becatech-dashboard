// Legacy wide-Excel adapter for the "SUPPORT ACTIVITY LOG" tab — one row per scholar with a
// genuine two-row merged header: row 1 is block labels ("DIÁGNOSTICO: MES N" /
// "INTERVENCIÓN: PARTICIPACIÓN EN ACTIVIDADES"), row 2 is sub-column names that REPEAT
// identically across all 6 month blocks (unlike SCHOLAR GENERAL INFO's per-term columns, which
// embed the period in the header text itself, e.g. "GPA 2024-1"). Regex-on-header-text can't
// disambiguate repeated names, so this parses positionally instead: each activity column is
// bucketed under the nearest preceding "MES" column, and that MES cell's own value (an actual
// calendar period the mentor fills in) becomes the row's `period` — not the block label text.
//
// Scope note: only the "INTERVENCIÓN: PARTICIPACIÓN EN ACTIVIDADES" sub-block is imported (→
// SupportActivity). The "DIÁGNOSTICO" sub-block (risk/academic/psychosocial status per month) is
// out of scope — those dimensions are already covered by the MENTOR REPORTS and check-in imports,
// and there's no clean 1:1 target field for them on SupportActivity.
import * as XLSX from "xlsx";
import type { ActivityType } from "../../../generated/prisma/enums";
import { coerceValue } from "../coerce";
import type { ParsedSheet } from "../parse";
import type { CanonicalRow } from "../types";
import { mapCountry, normKey } from "./shared";

const ACTIVITY_TYPE_BY_KEY: Record<string, ActivityType> = {
  "tutorias ind": "INDIVIDUAL_TUTORING",
  "tutorias grup": "GROUP_TUTORING",
  "mentorias ind": "INDIVIDUAL_MENTORING",
  "mentorias grup": "GROUP_MENTORING",
  talleres: "WORKSHOP",
};

const SUB_HEADER_OFFSET = 1; // relative to the sheet's own start row: block labels, then sub-columns.
const FIRST_DATA_OFFSET = 2;

/** The sheet's own starting row (0-based) — usually 0, but never assume it. */
function sheetStartRow(sheet: ParsedSheet): number {
  const ref = sheet.sheet?.["!ref"];
  return ref ? XLSX.utils.decode_range(ref).s.r : 0;
}

function rawRows(sheet: ParsedSheet): unknown[][] {
  if (!sheet.sheet) return [];
  // blankrows:true so array index i always maps to physical row (sheetStartRow(sheet) + i).
  return XLSX.utils.sheet_to_json<unknown[]>(sheet.sheet, {
    header: 1,
    defval: null,
    raw: true,
    blankrows: true,
  });
}

export function isSupportActivityLogSheet(sheet: ParsedSheet): boolean {
  const rows = rawRows(sheet);
  const subHeader = rows[SUB_HEADER_OFFSET];
  if (!subHeader) return false;
  const keys = subHeader.map(normKey);
  return normKey(subHeader[0]) === "id" && keys.includes("mes") && keys.includes("tutorias ind");
}

interface ActivityColumn {
  colIndex: number;
  mesColIndex: number;
  activityType: ActivityType;
}

/** Bucket each activity column under the nearest preceding "MES" column, left to right. */
function findActivityColumns(subHeader: unknown[]): ActivityColumn[] {
  const columns: ActivityColumn[] = [];
  let mesColIndex = -1;
  subHeader.forEach((cell, colIndex) => {
    const key = normKey(cell);
    if (key === "mes") {
      mesColIndex = colIndex;
      return;
    }
    const activityType = ACTIVITY_TYPE_BY_KEY[key];
    if (activityType && mesColIndex >= 0) {
      columns.push({ colIndex, mesColIndex, activityType });
    }
  });
  return columns;
}

export function supportActivityLogLegacyAdapter(sheet: ParsedSheet): CanonicalRow[] {
  const rows = rawRows(sheet);
  const subHeader = rows[SUB_HEADER_OFFSET];
  if (!subHeader) return [];

  const activityColumns = findActivityColumns(subHeader);
  const out: CanonicalRow[] = [];
  const startRow = sheetStartRow(sheet);

  for (let r = FIRST_DATA_OFFSET; r < rows.length; r++) {
    const row = rows[r] ?? [];
    const scholarId = coerceValue(row[0], "string");
    if (typeof scholarId !== "string" || scholarId === "") continue; // skip blank rows

    const country = mapCountry(row[1]);
    const cohort = coerceValue(row[5], "string");
    const university = coerceValue(row[6], "string");
    const rowNumber = startRow + r + 1; // 1-based physical row number

    for (const { colIndex, mesColIndex, activityType } of activityColumns) {
      const period = coerceValue(row[mesColIndex], "string");
      if (typeof period !== "string" || period === "") continue; // month hasn't happened yet

      out.push({
        rowNumber,
        data: {
          scholarId,
          period,
          activityType,
          activityCount: coerceValue(row[colIndex], "int"),
          country,
          cohort,
          university,
          source: "google-sheets-sync",
        },
      });
    }
  }

  return out;
}
