// Dev tool: scan the database for data-quality issues and record them.
// Usage: npm run data-quality:scan
import "dotenv/config";
import { runDataQualityScan } from "../lib/data-quality/checks";
import { prisma } from "../lib/db";

async function main() {
  const { detected, persisted } = await runDataQualityScan();
  const byType = detected.reduce<Record<string, number>>((acc, i) => {
    acc[i.issueType] = (acc[i.issueType] ?? 0) + 1;
    return acc;
  }, {});
  console.log(`Detected ${detected.length} issue(s); persisted ${persisted} to DataQualityIssue.`);
  console.table(byType);
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
