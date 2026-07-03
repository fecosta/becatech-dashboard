// Generate a blank .xlsx template (header row + one example row) for an entity.
import * as XLSX from "xlsx";
import { TEMPLATE_COLUMNS } from "./templates";
import type { ImportEntity } from "./types";

export function generateTemplate(entity: ImportEntity): Buffer {
  const cols = TEMPLATE_COLUMNS[entity];
  const headers = cols.map((c) => c.field);
  const example = cols.map((c) => c.example ?? "");
  const ws = XLSX.utils.aoa_to_sheet([headers, example]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, entity.slice(0, 31));
  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
}
