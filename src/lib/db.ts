// Prisma client singleton.
// Prisma 7 uses the query compiler + a driver adapter, so we build the client with
// @prisma/adapter-pg from DATABASE_URL. The singleton pattern avoids exhausting the
// connection pool during Next.js hot-reload in development.
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error(
    "DATABASE_URL is not set. Copy .env.example to .env and run `docker compose up -d`.",
  );
}

const adapter = new PrismaPg({ connectionString });

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

export const prisma = globalForPrisma.prisma ?? new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
