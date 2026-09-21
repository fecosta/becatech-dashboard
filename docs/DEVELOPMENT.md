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
- **Supabase Storage (server-only)** — `SUPABASE_SERVICE_ROLE_KEY`, used to generate
  short-lived signed URLs for the private `scholar-photos` bucket on the Scholar Profile
  page; see `src/lib/scholars/photos.ts` and `docs/adr/009-supabase-storage-scholar-photos.md`.
  Reuses `NEXT_PUBLIC_SUPABASE_URL` for the endpoint unless a separate `SUPABASE_URL` is
  set. Never prefix with `NEXT_PUBLIC_`.
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
| `npm run db:seed:operators` | `tsx prisma/seed-operators.ts` — the four canonical `Operator` rows only; insert-only and idempotent, safe to run against production, never touches scholar data |
| `npm run db:reset` | `prisma migrate reset` — drop, re-migrate, re-seed |
| `npm run db:studio` | `prisma studio` — browse the database |

### Reference data in a new environment

`prisma migrate deploy` creates tables, never rows, and the production deploy runs nothing else —
so a fresh environment starts with no reference data. `npm run db:seed` is demo data and must
never be run against production. The two production-safe seeds are the ones to run instead:

```bash
npm run db:seed:users       # real AppUser accounts, including the sync system user
npm run db:seed:operators   # the four canonical Operator rows
```

Both are idempotent and touch only their own table. `db:seed:operators` is additionally
conflict-atomic: if an existing Operator carries a canonical name with a different country or
track, it writes nothing at all — no row created, none modified — and exits non-zero for a
human to settle, rather than leaving the catalog half-provisioned.

`Operator` in particular is a prerequisite for ingestion, not an output of it: the import
validator resolves the sheet's `Current Operator -  Support Services` column (`FATV`, `ESCALO`,
`MAKERS`) against this catalog and never auto-creates a row from a spreadsheet value. With the
catalog missing, every scholar still imports successfully but with `operatorId` null — silently,
because an unrecognized operator deliberately does not reject the scholar.

### Recovering scholars left with no operator

If scholars are already in the database with `operatorId` null because the catalog was missing,
do not update them by hand and do not infer an operator from country, cohort, semester or program
stage. The authoritative source column already holds the answer; let a normal sync apply it:

1. Deploy the reference-data fix.
2. Run `npm run db:seed:operators` against the environment, and confirm it reports four rows.
3. Verify the catalog:
   ```sql
   SELECT name, country, track FROM "Operator" ORDER BY track, name;
   ```
4. Trigger the normal Google Sheets sync (`apps-script/Sync.gs`), which re-POSTs the
   `NORMALIZED_SCHOLAR` tab to `/api/sync/import`.
5. Verify the result:
   ```sql
   SELECT COUNT(*) AS total_scholars,
          COUNT("operatorId") AS scholars_with_operator,
          COUNT(*) - COUNT("operatorId") AS scholars_without_operator
   FROM "Scholar";
   ```

Step 4 works without a backfill because the scholar upsert writes `operatorId` from the resolved
source value on every sync (`bulkUpsert`'s `ON CONFLICT DO UPDATE`), so existing rows move from
null to the correct FK in place. Scholars whose source value is `Not applicable` correctly stay
null.

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
