// Backfill MentorReport.programMonth (and semester, only when the sheet value is blank) from each
// report's country + sessionDate, using the confirmed program-calendar windows.
// Usage: npm run backfill:program-month            (writes changes)
//        npm run backfill:program-month -- --dry-run   (reports only, no writes)
//
// Aggregate output only — no scholar PII. Unresolved rows (session date outside every configured
// window, or missing country/date) are reported, never guessed.
import "dotenv/config";
import type { Country } from "../generated/prisma/enums";
import { prisma } from "../lib/db";
import { resolveProgramMonth } from "../lib/program-calendar";

const nz = (s: string | null): string | null => (s && s.trim() ? s : null);

async function main() {
  const dryRun = process.argv.includes("--dry-run");

  const reports = await prisma.mentorReport.findMany({
    select: { id: true, country: true, sessionDate: true, semester: true, programMonth: true },
  });

  const perCountry = new Map<string, { resolved: number; unresolved: number }>();
  const bump = (country: string, key: "resolved" | "unresolved") => {
    const row = perCountry.get(country) ?? { resolved: 0, unresolved: 0 };
    row[key] += 1;
    perCountry.set(country, row);
  };

  let updated = 0;
  let nullCountry = 0;
  let nullSessionDate = 0;

  for (const m of reports) {
    const derived = resolveProgramMonth(m.country as Country | null, m.sessionDate);
    const countryLabel = m.country ?? "unknown";

    if (!m.country) nullCountry += 1;
    if (!m.sessionDate) nullSessionDate += 1;
    bump(countryLabel, derived.programMonth ? "resolved" : "unresolved");

    const newProgramMonth = derived.programMonth; // string | null
    const newSemester = nz(m.semester) ?? derived.semester; // preserve sheet value, else derived
    const changed = nz(m.programMonth) !== newProgramMonth || nz(m.semester) !== newSemester;

    if (changed) {
      updated += 1;
      if (!dryRun) {
        await prisma.mentorReport.update({
          where: { id: m.id },
          data: { programMonth: newProgramMonth, semester: newSemester },
        });
      }
    }
  }

  const totalResolved = [...perCountry.values()].reduce((n, r) => n + r.resolved, 0);
  const totalUnresolved = reports.length - totalResolved;

  console.log(`${dryRun ? "[dry-run] " : ""}Scanned ${reports.length} mentor report(s).`);
  console.table(Object.fromEntries(perCountry));
  console.log(
    `Resolved: ${totalResolved} · Unresolved: ${totalUnresolved} ` +
      `(of which null country: ${nullCountry}, null session date: ${nullSessionDate}).`,
  );
  console.log(`${dryRun ? "Would update" : "Updated"} ${updated} row(s).`);
  if (totalUnresolved - nullCountry - nullSessionDate > 0) {
    console.log(
      "Note: some reports have a country + session date but still fell outside the confirmed 2026-1 " +
        "windows — confirm the calendar with the program owner before extending PROGRAM_CALENDAR.",
    );
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
