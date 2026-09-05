// Semester labels ("2026-1", "2026-2", ...) order by year then term number, never lexically for
// the term half alone (a 2-digit year never arises here, so lexical/numeric agree on year, but
// spelling this out mirrors src/lib/dashboard/program-month.ts's stance on "MES n" — a different
// domain, not calendar months either).

/** Parse a "YYYY-N" semester label into its year/term parts, or null if it isn't shaped that way.
 *  The term is a single digit deliberately — this must reject a calendar-month fallback period
 *  like "2026-06" (RiskAssessment.period's other possible shape), which a 2-digit term would
 *  otherwise misparse as a valid semester. */
export function parseSemester(semester: string | null | undefined): { year: number; term: number } | null {
  const m = /^(\d{4})-(\d)$/.exec(String(semester ?? "").trim());
  return m ? { year: Number(m[1]), term: Number(m[2]) } : null;
}

/** Compare two semester labels chronologically (year, then term); falls back to string order when
 *  either side isn't "YYYY-N"-shaped. */
export function compareSemesters(a: string, b: string): number {
  const pa = parseSemester(a);
  const pb = parseSemester(b);
  if (pa && pb) return pa.year - pb.year || pa.term - pb.term;
  return a.localeCompare(b);
}

/** The latest semester among the given labels, or null if the list is empty. */
export function latestSemester(semesters: string[]): string | null {
  if (semesters.length === 0) return null;
  return [...semesters].sort(compareSemesters).at(-1) ?? null;
}
