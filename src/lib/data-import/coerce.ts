// Value coercion for imported cells. Empty ⇒ null; bad numbers ⇒ NaN; bad dates ⇒
// Invalid Date — the validator detects those and reports row-level errors.
import type { FieldType } from "./types";

export function parseBool(value: unknown): boolean | null {
  if (typeof value === "boolean") return value;
  const s = String(value).trim().toLowerCase();
  if (/^(true|1|yes|s[ií]|x)$/.test(s)) return true;
  if (/^(false|0|no)$/.test(s)) return false;
  return null;
}

export function coerceValue(value: unknown, type: FieldType): unknown {
  if (value === null || value === undefined) return null;
  if (typeof value === "string" && value.trim() === "") return null;

  switch (type) {
    case "string":
      return String(value).trim();
    case "int": {
      const n = Number(value);
      return Number.isFinite(n) ? Math.trunc(n) : Number.NaN;
    }
    case "float": {
      const n = Number(value);
      return Number.isFinite(n) ? n : Number.NaN;
    }
    case "date": {
      if (value instanceof Date) return value;
      return new Date(String(value)); // Invalid Date if unparseable
    }
    case "boolean":
      return parseBool(value);
  }
}

export const isBadNumber = (v: unknown): boolean => typeof v === "number" && Number.isNaN(v);
export const isBadDate = (v: unknown): boolean => v instanceof Date && Number.isNaN(v.getTime());
