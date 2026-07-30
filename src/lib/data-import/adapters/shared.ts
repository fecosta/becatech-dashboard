// Small helpers shared by the legacy wide-Excel adapters (general-info, mentor-reports,
// support-activity-log). Extracted so the per-tab adapter modules don't import from each other.

/** Strip accents, lowercase, collapse whitespace. */
export function normKey(k: unknown): string {
  return String(k ?? "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export function indexRecord(rec: Record<string, unknown>): Map<string, unknown> {
  const idx = new Map<string, unknown>();
  for (const [k, v] of Object.entries(rec)) idx.set(normKey(k), v);
  return idx;
}

export function mapCountry(v: unknown): string | undefined {
  const s = normKey(v);
  if (!s) return undefined;
  if (s.startsWith("col")) return "COLOMBIA";
  if (s.startsWith("per")) return "PERU";
  return String(v).trim();
}

export function mapStatus(v: unknown): string | undefined {
  const s = normKey(v);
  if (!s) return undefined;
  // Real sheet values are like "BECARIO(A) ACTIVO" — the keyword isn't a prefix, so this
  // matches anywhere in the string, not just at position 0.
  if (s.includes("activ")) return "ACTIVE";
  if (s.includes("retir") || s.includes("desert")) return "WITHDRAWN";
  if (s.includes("gradu")) return "GRADUATED";
  if (s.includes("paus")) return "PAUSED";
  return String(v).trim();
}
