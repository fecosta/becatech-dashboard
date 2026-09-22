# TASK-006 — Migrate the local container runtime to OrbStack

Status: Completed
Owner: Engineering
Related spec: None (developer environment, no product behavior)
Related ADRs: None — see "Architecture impact" below
Created: 2026-09-22
Completed: 2026-09-22

## Objective

Make OrbStack the recommended Docker-compatible runtime for local development on macOS, without
changing the local database architecture: Docker Compose stays the orchestration interface,
PostgreSQL 16 stays in a container, and the host port stays 5433.

Explicitly out of scope: this does not introduce a local Supabase stack. The repository has
none, and Supabase Auth and Storage remain remote integrations in every environment.

## Audit findings

The repository had no Docker Desktop-specific dependency:

- `docker-compose.yml` uses only portable primitives (image, env, published port, named volume,
  `pg_isready` healthcheck) — no socket mounts, no `host.docker.internal`, no `platform` pin, no
  macOS bind mounts. `docker compose config` resolves identically under both runtimes.
- Prisma reaches Postgres over TCP at `localhost:5433`; `prisma.config.ts` and `src/lib/db.ts`
  only read `DATABASE_URL` / `DIRECT_URL`.
- `vitest.integration.globalSetup.ts` connects with the `pg` client and shells out to
  `prisma migrate deploy` — it never touches the Docker CLI or socket.
- `.env.example` needs no change; `DATABASE_URL`, `DIRECT_URL` and `TEST_DATABASE_URL` are
  runtime-independent.
- The only Docker Desktop reference in the repository was the `docs/DEVELOPMENT.md` prerequisite
  line, which conflated the runtime with Compose.

So the change is documentation only. No Compose, Prisma, env, schema or test change was made.

## Architecture impact

None requiring an ADR. The persistence architecture recorded in `AGENTS.md` and
`docs/ARCHITECTURE.md` — PostgreSQL 16, local Docker Compose, Supabase in Preview/Production —
is unchanged. Which Docker-compatible daemon a developer runs on their own Mac is a tooling
choice, not a source-of-truth or persistence decision. `AGENTS.md` wording ("local: Docker
Compose") remains accurate and was left alone.

## Data handling

The Compose named volume is owned by whichever runtime created it, so OrbStack starts from an
empty `becatech_pgdata`. That is acceptable here: the local database contained only the
reproducible demo seed (100 mock scholars, 14 demo users, 0 import batches), rebuilt with
`npm run db:migrate` + `npm run db:seed`.

No destructive command was run. `docker compose down` (not `-v`) was used, so the Docker Desktop
volume still exists and `docker context use desktop-linux` restores the previous state. A
`pg_dump -Fc` export was taken beforehand as insurance; `docs/DEVELOPMENT.md` documents that
dump/restore path as the supported way to carry real local data across runtimes.

## Validation

Performed on macOS with the CLI pointed at OrbStack (`docker context show` → `orbstack`,
`docker info` → OrbStack, server 29.4.0):

| Check | Result |
|---|---|
| `docker compose up -d` + `docker compose ps` | `becatech-db` Up (healthy), `0.0.0.0:5433->5432/tcp` |
| `npx prisma migrate deploy` + `prisma migrate status` | all migrations applied, schema up to date |
| `npm run db:seed` | seeded (100 scholars, 14 users) |
| `npm run dashboard:check` | every dashboard query ran against the seeded data |
| `npm run lint` | 0 errors (1 pre-existing `no-img-element` warning) |
| `npm test` | 47 files, 327 tests passed |
| `npm run test:integration` | 11 files, 98 tests passed |
| `npm run build` | passed |

`prisma migrate dev` was deliberately not run, to avoid authoring an unintended migration.
