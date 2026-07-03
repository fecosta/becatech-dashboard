// Template adapter: near pass-through mapping of a single-entity sheet's records to
// canonical rows. Headers are the Prisma field names (plus a few friendly aliases).
import { coerceValue } from "../coerce";
import { HEADER_ALIASES, TEMPLATE_COLUMNS } from "../templates";
import type { CanonicalBatch, FieldType, ImportEntity, RawRecord } from "../types";

const norm = (h: string) => h.trim().toLowerCase();

export function templateAdapter(entity: ImportEntity, records: RawRecord[]): CanonicalBatch {
  const cols = TEMPLATE_COLUMNS[entity];
  const headerToField = new Map<string, { field: string; type: FieldType }>();
  for (const c of cols) headerToField.set(norm(c.field), { field: c.field, type: c.type });
  for (const [alias, field] of Object.entries(HEADER_ALIASES)) {
    const col = cols.find((c) => c.field === field);
    if (col) headerToField.set(norm(alias), { field, type: col.type });
  }

  const rows = records.map((record, i) => {
    const data: Record<string, unknown> = {};
    for (const [header, value] of Object.entries(record)) {
      const target = headerToField.get(norm(header));
      if (target) data[target.field] = coerceValue(value, target.type);
    }
    return { rowNumber: i + 2, data }; // +2: row 1 is the header row
  });

  return { [entity]: rows };
}
