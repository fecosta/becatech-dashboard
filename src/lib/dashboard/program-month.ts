// Program months ("MES 1".."MES 6") are the program's real reporting cadence and the key risk is
// stored against (see src/lib/risk/from-mentor-report.ts). They are NOT calendar months, so they
// must be ordered by their number, not lexically ("MES 10" > "MES 9", and "MES 6" > "MES 06/…").

/** Extract the program-month number from a "MES n" label, or null if it isn't one. */
export function programMonthNumber(period: string | null | undefined): number | null {
  const m = /^mes\s*(\d+)$/i.exec(String(period ?? "").trim());
  return m ? Number(m[1]) : null;
}

/** The latest program month among the given periods (canonical "MES n"), or null if none qualify. */
export function latestProgramMonth(periods: (string | null | undefined)[]): string | null {
  let best: number | null = null;
  for (const p of periods) {
    const n = programMonthNumber(p);
    if (n != null && (best == null || n > best)) best = n;
  }
  return best == null ? null : `MES ${best}`;
}

/** Sort program-month labels ascending by number (non-MES values sort last, stably). */
export function sortProgramMonths(periods: string[]): string[] {
  return [...periods].sort((a, b) => {
    const na = programMonthNumber(a);
    const nb = programMonthNumber(b);
    if (na == null && nb == null) return a.localeCompare(b);
    if (na == null) return 1;
    if (nb == null) return -1;
    return na - nb;
  });
}
