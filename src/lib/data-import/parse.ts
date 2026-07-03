// Parse an uploaded .xlsx/.csv buffer into per-sheet records (header → cell value).
// Uses SheetJS. Kept in-memory (batch sizes are small at current scale).
import * as XLSX from "xlsx";
import type { RawRecord } from "./types";

export interface ParsedSheet {
  sheetName: string;
  records: RawRecord[];
}

export function parseWorkbook(data: ArrayBuffer | Uint8Array): ParsedSheet[] {
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
  // Only enable date coercion for real .xlsx (zip: "PK"). For CSV it would wrongly turn
  // period/term strings like "2026-07" or "2026-1" into Dates; keep those as text and let
  // per-field coercion (coerce.ts) parse genuine date columns from ISO strings.
  const isXlsx = bytes[0] === 0x50 && bytes[1] === 0x4b;
  const wb = XLSX.read(bytes, { type: "array", cellDates: isXlsx, raw: true });
  return wb.SheetNames.map((sheetName) => ({
    sheetName,
    records: XLSX.utils.sheet_to_json<RawRecord>(wb.Sheets[sheetName], {
      defval: null,
      raw: true,
      blankrows: false,
    }),
  }));
}
