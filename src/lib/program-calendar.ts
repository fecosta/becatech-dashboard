// Map a mentoring session's date to the program's own reporting cadence: a program month
// ("MES 1".."MES 6") inside a semester ("2026-1"). The program does NOT use calendar months — a
// date maps to a MES via country-specific windows (Colombia's are academic-calendar ranges that are
// not month-aligned; Peru's happen to line up with calendar months). This is a separate concern from
// src/lib/dashboard/program-month.ts, which only ORDERS "MES n" labels and knows nothing about dates.
//
// IMPORTANT: the windows below are CONFIRMED FOR SEMESTER 2026-1 ONLY. There is no rule to
// extrapolate to other semesters — the day offsets are not guaranteed to repeat. Adding a future
// semester is a DATA change (append windows to PROGRAM_CALENDAR), never a code/offset change, and
// must be re-confirmed with the program team each semester. A date outside every configured window
// resolves to null (we never guess a program month).
import type { Country } from "../generated/prisma/enums";

/** One program-month window: an inclusive [start, end] calendar range for a (country, semester). */
export type ProgramCalendarWindow = {
  semester: string;
  programMonth: string;
  /** Inclusive UTC calendar dates, ISO "YYYY-MM-DD". */
  start: string;
  end: string;
};

// Confirmed by the program spreadsheet owner for semester 2026-1. Do not alter these ranges.
export const PROGRAM_CALENDAR: Record<Country, ProgramCalendarWindow[]> = {
  COLOMBIA: [
    { semester: "2026-1", programMonth: "MES 1", start: "2026-02-17", end: "2026-03-15" },
    { semester: "2026-1", programMonth: "MES 2", start: "2026-03-16", end: "2026-04-14" },
    { semester: "2026-1", programMonth: "MES 3", start: "2026-04-15", end: "2026-05-11" },
    { semester: "2026-1", programMonth: "MES 4", start: "2026-05-12", end: "2026-06-10" },
    { semester: "2026-1", programMonth: "MES 5", start: "2026-06-11", end: "2026-07-10" },
    { semester: "2026-1", programMonth: "MES 6", start: "2026-07-11", end: "2026-07-31" },
  ],
  PERU: [
    { semester: "2026-1", programMonth: "MES 1", start: "2026-03-01", end: "2026-03-31" },
    { semester: "2026-1", programMonth: "MES 2", start: "2026-04-01", end: "2026-04-30" },
    { semester: "2026-1", programMonth: "MES 3", start: "2026-05-01", end: "2026-05-31" },
    { semester: "2026-1", programMonth: "MES 4", start: "2026-06-01", end: "2026-06-30" },
    { semester: "2026-1", programMonth: "MES 5", start: "2026-07-01", end: "2026-07-31" },
  ],
};

/** UTC-midnight epoch for the calendar day of `date` (drops any time-of-day). */
function utcDay(date: Date): number {
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

/** UTC-midnight epoch for an ISO "YYYY-MM-DD" window bound. */
function utcDayFromIso(iso: string): number {
  const [y, m, d] = iso.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}

/**
 * Resolve a session's `{ semester, programMonth }` from its country and date, using the confirmed
 * program-calendar windows. Returns `{ null, null }` when the country/date is missing or invalid, or
 * when the date falls outside every configured window (unconfigured semester, or a gap) — never a
 * guess. Bounds are inclusive and compared in UTC to match the adapter's UTC-midnight date parsing.
 */
export function resolveProgramMonth(
  country: Country | null | undefined,
  sessionDate: Date | null | undefined,
): { semester: string | null; programMonth: string | null } {
  const none = { semester: null, programMonth: null };
  if (!country) return none;
  const windows = PROGRAM_CALENDAR[country];
  if (!windows) return none;
  if (!(sessionDate instanceof Date) || Number.isNaN(sessionDate.getTime())) return none;

  const day = utcDay(sessionDate);
  for (const w of windows) {
    if (day >= utcDayFromIso(w.start) && day <= utcDayFromIso(w.end)) {
      return { semester: w.semester, programMonth: w.programMonth };
    }
  }
  return none;
}
