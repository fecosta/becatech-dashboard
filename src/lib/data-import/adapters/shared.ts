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

/** Bilingual lookup — first present value among several exact normalized keys (e.g. the old
 * sheet's Spanish header alongside the new sheet's English one). */
export function getAny(idx: Map<string, unknown>, keys: string[]): unknown {
  for (const k of keys) {
    if (idx.has(k)) return idx.get(k);
  }
  return undefined;
}

/** Bilingual version of a "find by substring, nth occurrence" lookup. */
export function findByIncludesAny(idx: Map<string, unknown>, substrs: string[], occurrence = 0): unknown {
  let count = 0;
  for (const [k, v] of idx) {
    if (substrs.some((s) => k.includes(s))) {
      if (count === occurrence) return v;
      count += 1;
    }
  }
  return undefined;
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

/** [normalized-prefix regex, semester number] — ordinal Spanish semester words. Mirrors
 *  apps-script/Normalize.gs's SEMESTER_WORD_RE_ exactly (same source data shape, ported here so
 *  the manual-upload path parses the same real-world cell values the automated sync already
 *  does — confirmed from production: "Sexto semestre", "Tercer semestre", etc.). */
const SEMESTER_WORD_RE: [RegExp, number][] = [
  [/^primer/, 1],
  [/^segund/, 2],
  [/^tercer/, 3],
  [/^cuart/, 4],
  [/^quint/, 5],
  [/^sext/, 6],
  [/^septim/, 7],
  [/^setim/, 7],
  [/^octav/, 8],
  [/^noven/, 9],
  [/^decim/, 10],
  [/^undecim/, 11],
  [/^duodecim/, 12],
];

/** "Sexto semestre" -> 6, "3er semestre" -> 3, 7 -> 7, "" / unparseable -> undefined (so it drops
 *  to null downstream via gN(), not NaN — same resilience rule as any other optional numeric
 *  field). Mirrors Normalize.gs's parseSemesterCell_. */
export function parseSemesterCell(v: unknown): number | undefined {
  if (v == null || v === "") return undefined;
  if (typeof v === "number") return v;
  const s = normKey(v);
  if (!s) return undefined;
  const digitMatch = /^(\d+)/.exec(s);
  if (digitMatch) return Number(digitMatch[1]);
  for (const [re, n] of SEMESTER_WORD_RE) {
    if (re.test(s)) return n;
  }
  return undefined;
}
