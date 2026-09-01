# ADR-005 — Prisma Migrations

Status: Accepted
Date: 2026-09-01 (documenting an already-established decision)

## Context

The dashboard's schema has evolved substantially since its initial migration — 11 migrations
exist under `prisma/migrations/` as of this writing, from the initial model through additions
like university/operator models, mentor-report and risk-assessment fields, the sync lock, and
the monthly-status import entity. Schema changes also interact with real, imported program data
(scholars, risk assessments, financial records) in Preview and Production, both of which share
one Supabase database — an uncontrolled schema change risks corrupting or losing that data.

## Decision

Prisma owns schema evolution. Every schema change goes through `prisma migrate dev` (`npm run
db:migrate`), producing a version-controlled migration file under `prisma/migrations/`. The
schema file's own header states this directly: *"Migrations: every change goes through `prisma
migrate dev` — never hand-edit the DB."*

- Migrations are committed to version control alongside the code that depends on them.
- Historical migrations are immutable — a past migration file is never edited after it has been
  applied anywhere; a further schema change is a new migration, not an edit to an old one.
- Manual production schema edits are prohibited.
- `npm run build` runs `prisma migrate deploy` only when `VERCEL_ENV=production` — Preview builds
  intentionally skip migrations against the shared database.

## Consequences

- Schema history is fully reconstructable from `prisma/migrations/`.
- A schema change must consider its impact on: `src/lib/data-import` (adapters, validators, and
  `bulkUpsert()`'s `ON CONFLICT` clauses, which key off `@@unique` constraints), seed scripts
  (`prisma/seed.ts`, `prisma/seed-users.ts`), the query layer (`src/lib/dashboard/queries.ts`),
  integration tests (`tests/integration/`), and data-quality checks
  (`src/lib/data-quality/checks.ts`) — all enumerated in `AGENTS.md`'s "Database Rules."
- Rolling back a bad migration means writing a new, corrective migration — not editing or
  deleting the old one.
- Changing a uniqueness constraint or a relation's `onDelete` behavior requires reviewing every
  import path that writes to that model, since the import pipeline's rollback and conflict-key
  logic depends on the current constraints.

## Alternatives Considered

No repository evidence of an alternative migration strategy (e.g. hand-written SQL migrations,
a different ORM) having been implemented or documented — omitted rather than invented.
