# Beca Tech Scholars Progress Dashboard

Decision-support dashboard for the **ver+ Beca Tech** program. It centralizes scholar tracking,
risk monitoring, academic progress, support participation, requests, unit economics, and a
selection pipeline into a normalized PostgreSQL database with a Next.js dashboard on top.

The canonical program key is **`ID_becario`**, stored throughout as `scholarId`.

## Stack

| Layer      | Choice                                             |
| ---------- | -------------------------------------------------- |
| Framework  | Next.js (App Router) + TypeScript                  |
| Database   | PostgreSQL 16                                       |
| ORM        | Prisma 7 (query compiler + `@prisma/adapter-pg`)   |
| Styling    | Tailwind CSS v4                                     |
| Charts     | Recharts                                            |
| Tests      | Vitest                                              |
| Local DB   | Docker Compose                                      |
| Deploy     | Vercel + Neon / Vercel Postgres                     |

## Prerequisites

- Node.js 20+ (developed on v22)
- Docker Desktop (for the local Postgres)
- npm

## Setup

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env        # defaults already match the docker-compose Postgres

# 3. Start the local database (host port 5433 to avoid colliding with a local Postgres)
docker compose up -d

# 4. Generate the Prisma client
npm run db:generate

# 5. Apply migrations
npm run db:migrate

# 6. Seed demo data  (full ~100-scholar dataset lands in Sprint 2)
npm run db:seed

# 7. Run the app
npm run dev            # http://localhost:3000
```

## Environment variables

See [`.env.example`](./.env.example). Summary:

| Variable                | Purpose                                                                          |
| ----------------------- | -------------------------------------------------------------------------------- |
| `DATABASE_URL`          | Postgres connection used by the app at runtime (pooled URL in production).       |
| `DIRECT_URL`            | Direct (non-pooled) connection used by Prisma Migrate. Locally same as above.    |
| `DEMO_USER_EMAIL`       | Mock-auth: which seeded demo user the app acts as during the MVP.                |
| `JOTFORM_API_KEY`       | Placeholder — the MVP does not call the live JotForm API.                        |
| `JOTFORM_WEBHOOK_SECRET`| Placeholder for future webhook verification.                                     |

> **Prisma 7 note:** connection URLs are **not** in `schema.prisma`. Prisma Migrate reads the URL
> from [`prisma.config.ts`](./prisma.config.ts) (which loads `.env` via `dotenv`), and the runtime
> client builds a `pg` driver adapter from `DATABASE_URL` in [`src/lib/db.ts`](./src/lib/db.ts).

## Scripts

| Script                      | Description                                               |
| --------------------------- | --------------------------------------------------------- |
| `npm run dev`               | Start the Next.js dev server.                             |
| `npm run build` / `start`   | Production build / start.                                 |
| `npm run db:generate`       | Generate the Prisma client.                               |
| `npm run db:migrate`        | Create + apply a dev migration (`prisma migrate dev`).    |
| `npm run db:seed`           | Seed demo data (`tsx prisma/seed.ts`).                    |
| `npm run db:reset`          | Drop, re-migrate, and re-seed the database.               |
| `npm run db:studio`         | Open Prisma Studio to browse data.                        |
| `npm run test`              | Run Vitest.                                               |

## Database

The schema lives in [`prisma/schema.prisma`](./prisma/schema.prisma) — a normalized model with 15
tables (scholars, academic terms, monthly check-ins, mentor reports, support activities, requests,
risk assessments, financial inputs, selection candidates + stage history, raw JotForm submissions,
data-quality issues, control values, app users, and user↔scholar access).

Every schema change goes through a migration (`npm run db:migrate`) — never hand-edit the database.

### Local database notes

- Docker maps Postgres to host port **5433** (see [`docker-compose.yml`](./docker-compose.yml)) to
  avoid colliding with a Postgres already listening on the default 5432. If 5433 is also taken,
  change the mapping and update `DATABASE_URL` / `DIRECT_URL`.
- Credentials (dev only): user `becatech`, password `becatech`, database `beca_tech_dashboard`.
- `docker compose down -v` removes the data volume for a clean slate.

## Deployment (Vercel + Neon / Vercel Postgres)

Provision a Postgres database (Neon or Vercel Postgres), then set on Vercel:

- `DATABASE_URL` → the **pooled** connection string
- `DIRECT_URL` → the **direct** connection string (used by migrations)

Run migrations against the direct URL as part of your release step (`prisma migrate deploy`).
_Full deploy walkthrough is finalized in Sprint 7._

## Project status

Built sprint by sprint (see the implementation plan). **Sprint 1 (database & app foundation)** is
complete: Next.js app scaffolded, full Prisma schema + initial migration, Docker Postgres, env
templates, Prisma client singleton, and a seed scaffold.

Coming next: full demo seed (Sprint 2), dashboard query layer (Sprint 3), dashboard UI + routes
(Sprint 4), authorization + selection stage logic with tests (Sprint 5), JotForm placeholder +
data-quality checks (Sprint 6), and documentation polish including demo users and route reference
(Sprint 7).
