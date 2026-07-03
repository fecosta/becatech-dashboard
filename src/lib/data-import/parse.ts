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
  const wb = XLSX.read(bytes, { type: "array", cellDates: true });
  return wb.SheetNames.map((sheetName) => ({
    sheetName,
    records: XLSX.utils.sheet_to_json<RawRecord>(wb.Sheets[sheetName], {
      defval: null,
      raw: true,
      blankrows: false,
    }),
  }));
}
