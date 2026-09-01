# Development Guide

## Prerequisites

- Node.js 20+ (developed on v22; no `engines` field is set in `package.json`)
- Docker Desktop (for local PostgreSQL)
- npm

## Local Setup

```bash
npm install
cp .env.example .env      # then fill in DATABASE_URL, Supabase keys, etc. — see below
docker compose up -d      # starts Postgres on host port 5433
npm run db:generate
npm run db:migrate
npm run db:seed           # mock/demo data
npm run dev
```

Optional, once running:
```bash
npm test
npm run data-quality:scan
npm run db:studio
```

## Environment Variables

See `.env.example` for the full, commented list. Categories:

- **Database** — `DATABASE_URL`, `DIRECT_URL` (identical locally; on Vercel + a pooled provider,
  `DATABASE_URL` is the pooled connection and `DIRECT_URL` is the direct one, used by `prisma
  migrate`).
- **Supabase Auth** — `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
- **Local demo auth** — `DEMO_USER_EMAIL` (see `docs/SECURITY.md` — inert once `NODE_ENV` is
  `production`, which every real build sets).
- **JotForm (placeholder)** — `JOTFORM_API_KEY`, `JOTFORM_WEBHOOK_SECRET`. The MVP does not call
  the live JotForm API; see `docs/ARCHITECTURE.md`.
- **Google Sheets sync** — `SHEETS_SYNC_API_KEY` (the Apps Script's service-to-service secret —
  generate a long random value, set it here and in the Apps Script's own Script Properties, never
  hardcode it; see `apps-script/README.md`), `SYNC_AUTOMATION_PAUSED` (a display-only flag for
  the freshness badge — does not itself pause the Apps Script trigger).
- **Testing** — `TEST_DATABASE_URL` (a separate database on the same Docker Postgres instance,
  created/migrated automatically by the integration test's global setup).

Do not duplicate secret values into documentation — this section describes categories only.

## Database

| Command | Effect |
|---|---|
| `npm run db:generate` | `prisma generate` — regenerate the Prisma client |
| `npm run db:migrate` | `prisma migrate dev` — create + apply a dev migration |
| `npm run db:seed` | `tsx prisma/seed.ts` — mock demo data (scholars, terms, risk, etc.) |
| `npm run db:seed:users` | `tsx prisma/seed-users.ts` — real `AppUser` accounts only; safe to run against production, never touches scholar data |
| `npm run db:reset` | `prisma migrate reset` — drop, re-migrate, re-seed |
| `npm run db:studio` | `prisma studio` — browse the database |

Local Postgres is a single `postgres:16-alpine` container (`docker-compose.yml`), name
`becatech-db`, mapped to host port **5433** (not 5432, to avoid colliding with a local Postgres
install).

## Development Commands

| Command | Purpose |
|---|---|
| `npm run dev` | start the Next.js dev server |
| `npm run build` | production build; runs `prisma migrate deploy` first only when `VERCEL_ENV=production` |
| `npm run start` | start the production server |
| `npm run lint` | ESLint |
| `npm run dashboard:check` | run every dashboard query against the seeded data and print a summary |
| `npm run data-quality:scan` | run `src/lib/data-quality/checks.ts` and print/persist detected issues |
| `npm run backfill:program-month` | one-off backfill of `MentorReport.programMonth` for existing rows (`--dry-run` available) |
| `npm test` | unit tests (`vitest run`) |
| `npm run test:integration` | DB-backed integration tests |

## Testing

- **Unit** (`vitest.config.ts`) — `npm test`. Fast, no database. Includes `tests/**/*.test.ts`,
  excludes `tests/integration/**`. 35 files as of this writing.
- **Integration** (`vitest.integration.config.ts`) — `npm run test:integration`. Requires Docker
  Postgres running (`docker compose up -d`) and `TEST_DATABASE_URL` set. The global setup drops
  and recreates that database, then runs `prisma migrate deploy` against it, on every run. 7
  files as of this writing, `fileParallelism: false`, 60s timeouts.

Use integration tests (not unit tests) whenever a change touches real Prisma queries,
constraints, or transactional commit/rollback behavior — the import pipeline, risk ingestion, and
mentor-scoping tests all live there.

## Data Quality

`npm run data-quality:scan` runs the same checks the commit/rollback pipeline runs automatically
(`src/lib/data-quality/checks.ts`): missing cohort, orphaned check-ins/mentor-reports, missing
reporting month, unmapped program month, out-of-range GPA or risk value, risk rows missing a
source/reason, active scholars missing the latest check-in or mentor report, and duplicate
submission ids. Results are visible in the Admin → Data Quality dashboard page.

## Development Workflow

1. Select or create a spec (`specs/`, see `specs/README.md`) for anything beyond a small fix.
2. Inspect the existing implementation and its tests.
3. Plan a focused change — see `AGENTS.md`'s "Development Process."
4. Implement.
5. Test (unit, and integration if Prisma-backed behavior changed).
6. Review the diff.
7. Update documentation (this guide, `docs/ARCHITECTURE.md`, `docs/DATA_MODEL.md`, or an ADR, as
   relevant).
8. Move the spec to `specs/completed/`.

## Bug Fixes

Prefer a failing regression test before the fix — see `AGENTS.md`'s "Bug Fix Workflow."

## Database Changes

Require a Prisma migration (`npm run db:migrate`). Never hand-edit the database or a historical
migration file. See `docs/adr/005-prisma-migrations.md`.

## Architecture Changes

Require an ADR (`docs/adr/`) for anything in the list in `AGENTS.md`'s "Architecture Decisions"
section — canonical identifiers, auth, persistence architecture, external integrations,
authoritative data sources, etc.

## Google Sheets Sync (Apps Script)

`apps-script/Sync.gs` and `apps-script/Normalize.gs` run inside the program's Google Sheet, not
in this repository's deploy pipeline — there is no `clasp` project wired up. **A `git push` does
not deploy them.** Changes to either script must be pasted manually into the Sheet's
Extensions → Apps Script editor. See `apps-script/README.md` for the full setup and the Script
Properties (endpoint URL, `SHEETS_SYNC_API_KEY`) configuration.

## Completion Checklist

- `npm run lint` passes
- `npm test` passes
- `npm run test:integration` passes (when the change touched Prisma-backed behavior)
- `npm run build` passes when applicable
- authorization implications reviewed
- data implications reviewed
- relevant documentation updated
