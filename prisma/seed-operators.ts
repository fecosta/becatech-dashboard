// Production operator reference seed — provisions ONLY the four canonical Operator rows.
// Like prisma/seed-users.ts (and unlike prisma/seed.ts), this never clears or touches any other
// table, and never rewrites an Operator that already exists, so it's safe to run against a live
// production database. Insert-only and idempotent: re-running it is a no-op.
//
// Without this catalog the Google Sheets sync cannot resolve the source column
// "Current Operator -  Support Services" (FATV / ESCALO / MAKERS), and every scholar commits with
// operatorId null — which is exactly what happened in production. See the recovery sequence in
// docs/DEVELOPMENT.md.
//
// Run with: npm run db:seed:operators
import "dotenv/config";
import { prisma } from "../src/lib/db";
import { provisionOperators } from "../src/lib/data-import/reference-data";

async function main() {
  const { created, unchanged, skipped, conflicts } = await provisionOperators();

  if (conflicts.length) {
    // A canonical name already exists with different metadata. It may already have scholars
    // pointing at it, so this script rewrites nothing — and, because provisioning is
    // conflict-atomic, it also creates nothing. A human settles the conflict first.
    console.error("CONFLICT — existing Operator rows disagree with the canonical catalog:");
    for (const c of conflicts) {
      console.error(
        `  ${c.name}: database has ${c.actual.country}/${c.actual.track}, ` +
          `catalog expects ${c.expected.country}/${c.expected.track}`,
      );
    }
    console.error("\nNO CHANGES WERE MADE. No operator was created and no existing row was modified.");
    if (skipped.length) {
      console.error(`Not created (${skipped.length}): ${skipped.join(", ")}`);
    }
    if (unchanged.length) {
      console.error(`Already correct (${unchanged.length}): ${unchanged.join(", ")}`);
    }
    console.error("\nResolve the conflict, then re-run.");
    process.exitCode = 1;
    return;
  }

  if (created.length) console.log(`Created ${created.length} operator(s): ${created.join(", ")}`);
  if (unchanged.length) console.log(`Already present, unchanged: ${unchanged.join(", ")}`);
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
