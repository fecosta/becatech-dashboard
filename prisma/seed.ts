// Demo seed for the Beca Tech dashboard.
// Run with: npm run db:seed
//
// Scaffold only — the full ~100-scholar demo dataset is implemented in Sprint 2.
// `import "dotenv/config"` must stay first so DATABASE_URL is loaded before src/lib/db
// (which builds the Prisma pg adapter at module load) is evaluated.
import "dotenv/config";
import { prisma } from "../src/lib/db";

async function main() {
  const scholarCount = await prisma.scholar.count();
  console.log(`Seed scaffold OK — connected to the database. Scholars: ${scholarCount}`);
  console.log("Full demo seed lands in Sprint 2.");
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
