// Production user seed — creates/updates ONLY the real AppUser accounts below.
// Unlike prisma/seed.ts, this never clears or touches any other table (Scholar,
// University, etc.), so it's safe to run against a live production database.
// Run with: npm run db:seed:users
import "dotenv/config";
import { prisma } from "../src/lib/db";
import { UserRole } from "../src/generated/prisma/enums";
import type { Prisma } from "../src/generated/prisma/client";

const USERS: Prisma.AppUserCreateInput[] = [
  { id: "user-felipe-admin", fullName: "Felipe Costa", email: "felipe@velezreyesmas.com", role: UserRole.ANALYST_ADMIN },
  { id: "user-yineth-admin", fullName: "Yineth Paola Rentería", email: "yineth@velezreyesmas.com", role: UserRole.ANALYST_ADMIN },
  { id: "user-maribel-admin", fullName: "Maribel Corrales", email: "maribel@velezreyesmas.com", role: UserRole.ANALYST_ADMIN },
  // System user attributed to Google Sheets sync batches (POST /api/sync/import) — not a login.
  { id: "user-sheets-sync", fullName: "Google Sheets Sync", email: "sheets-sync@becatech.internal", role: UserRole.ANALYST_ADMIN },
];

async function main() {
  for (const user of USERS) {
    await prisma.appUser.upsert({
      where: { email: user.email },
      create: user,
      update: { fullName: user.fullName, role: user.role, isActive: true },
    });
  }
  console.log(`Upserted ${USERS.length} users:`, USERS.map((u) => u.email).join(", "));
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
