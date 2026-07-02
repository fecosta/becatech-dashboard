// Prisma CLI configuration (Prisma 7).
// `.env` is not auto-loaded by the CLI, so we import dotenv here. The datasource URL
// itself is declared in prisma/schema.prisma via env("DATABASE_URL") / env("DIRECT_URL"),
// which keeps a single source of truth and lets the runtime client read it too.
import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    // Connection used by Prisma Migrate. Prefer the DIRECT (non-pooled) URL when set —
    // e.g. on Vercel + Neon, DATABASE_URL is the pooled URL and DIRECT_URL is the direct one.
    // Locally both point at the docker-compose Postgres.
    url: process.env.DIRECT_URL ?? process.env.DATABASE_URL,
  },
});
