// Parse an uploaded .xlsx/.csv buffer into per-sheet records (header → cell value).
// Uses SheetJS. Kept in-memory (batch sizes are small at current scale).
import * as XLSX from "xlsx";
import type { RawRecord } from "./types";

export interface ParsedSheet {
  sheetName: string;
  records: RawRecord[];
  /**
   * Raw SheetJS worksheet, for adapters that need positional (row/column-index) access instead
   * of `records`' header-row-1 object shape — e.g. sheets with a real header below decorative
   * rows, or a two-row merged header with repeating sub-column names. Optional only so
   * hand-built test fixtures that don't need it can omit it; `parseWorkbook` always sets it.
   */
  sheet?: XLSX.WorkSheet;
}

export function parseWorkbook(data: ArrayBuffer | Uint8Array): ParsedSheet[] {
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
  // Only enable date coercion for real .xlsx (zip: "PK"). For CSV it would wrongly turn
  // period/term strings like "2026-07" or "2026-1" into Dates; keep those as text and let
  // per-field coercion (coerce.ts) parse genuine date columns from ISO strings.
  const isXlsx = bytes[0] === 0x50 && bytes[1] === 0x4b;
  // CSV/TSV bytes must be decoded as UTF-8 text ourselves: handing raw bytes to XLSX.read with
  // type "array" makes it guess an encoding (mangling accented Spanish text like "País" into
  // "PaÃ­s"), whereas decoding to a string first and reading with type "string" uses the bytes'
  // actual UTF-8 encoding correctly.
  const wb = isXlsx
    ? XLSX.read(bytes, { type: "array", cellDates: true, raw: true })
    : XLSX.read(new TextDecoder("utf-8").decode(bytes), { type: "string", raw: true });
  return wb.SheetNames.map((sheetName) => ({
    sheetName,
    sheet: wb.Sheets[sheetName],
    records: XLSX.utils.sheet_to_json<RawRecord>(wb.Sheets[sheetName], {
      defval: null,
      raw: true,
      blankrows: false,
    }),
  }));
}
