# AGENTS.md

## Project

Beca Tech+ Scholars Progress Dashboard — a decision-support dashboard for the Beca Tech
scholarship program. It centralizes scholar tracking, academic progress, risk monitoring,
support participation, requests, program operations, unit economics, selection, imports, and
data quality.

The application has an established architecture. Prefer extending existing patterns over
introducing new ones. See `docs/ARCHITECTURE.md` for the full picture; this file is the
operational contract for working in the codebase.

---

## Technology Stack

- Next.js 16.2.10 (App Router)
- React 19.2.4
- TypeScript ^5
- PostgreSQL 16 (local: Docker Compose, port 5433)
- Prisma 7.8.0, with `@prisma/adapter-pg`
- Supabase Auth (Google sign-in)
- Tailwind CSS 4 (CSS-based config, no `tailwind.config.*` file — tokens live in
  `src/app/globals.css`)
- Recharts 3.9.1
- Vitest 4.1.9 (unit + integration)
- Vercel (deploy), local Docker Compose (Postgres)

Do not replace core technologies without an approved ADR (`docs/adr/`).

---

## Canonical Scholar Identifier

The canonical program identifier is:

`ID_becario` → `Scholar.scholarId` (Prisma `@id`, a string, e.g. `"BT-CO-001"`)

`scholarId` is the identifier used throughout the application — in URLs
(`/dashboard/scholars/[scholarId]`), in every child table's foreign key, and in mentor
scholar-access scoping (`UserScholarAccess.scholarId`). See `docs/adr/001-canonical-scholar-identifier.md`.

Do not:
- introduce another canonical scholar ID;
- silently map scholars by email, phone, name, or a database-generated id;
- change scholar identity semantics;

without an approved ADR and explicit migration plan.

---

## Repository Boundaries

Business logic lives in domain modules under `src/lib`, not in presentation components.

```
src/lib/auth/          authentication + authorization (Supabase session → AppUser → permissions)
src/lib/dashboard/     the query layer + filter/routing helpers every dashboard page reads
src/lib/risk/          risk classification (ingestion, not derivation — see ADR-006)
src/lib/academic/      GPA, English level, academic-progress-label, program-stage/year parsing
src/lib/selection/     selection-pipeline stage transitions
src/lib/scholars/      scholar-facing parsers not owned by academic/ or risk/ (e.g. socioeconomic tier)
src/lib/jotform/       placeholder JotForm webhook ingestion (not live — see ARCHITECTURE.md)
src/lib/data-import/   import batch lifecycle: parse → validate → commit → rollback
src/lib/data-quality/  data-quality scan checks
src/lib/program-calendar.ts   country-specific program-month (MES n) calendar windows
src/lib/display/       source-value → display-value formatting
src/lib/supabase/      Supabase client factories (server/browser)
src/lib/db.ts          the Prisma client singleton
```

UI routes live under `src/app` (App Router). Reusable UI belongs under `src/components`.
Database schema and migrations belong under `prisma`. Tests belong under `tests`, mirroring the
`src/lib` domain structure where practical.

---

## Database Rules

All schema changes go through Prisma migrations (`npm run db:migrate`, i.e. `prisma migrate dev`).

Never:
- manually modify the production database;
- edit historical migrations under `prisma/migrations/`;
- silently change model relationships;
- change uniqueness constraints without reviewing import implications (`bulkUpsert()` in
  `src/lib/data-import/bulk-upsert.ts` keys its `ON CONFLICT` clause on the model's `@@unique`);
- change canonical identifiers without an ADR.

Before changing `prisma/schema.prisma`, inspect:
- `src/lib/data-import/` (adapters, validation, commit, bulk-upsert conflict keys);
- `prisma/seed.ts` and `prisma/seed-users.ts`;
- `src/lib/dashboard/queries.ts` (the query layer reads most models);
- `tests/integration/` (DB-backed tests exercise real constraints);
- `src/lib/data-quality/checks.ts` (some checks assume specific fields/ranges);
- rollback behavior in `src/lib/data-import/service.ts::rollbackImportBatch` (insert-only,
  keyed off `DataImportBatch.insertedRefs`).

See `docs/DATA_MODEL.md` and `docs/adr/005-prisma-migrations.md`.

---

## Authentication and Authorization

Authentication uses Supabase Auth with Google sign-in (`src/lib/supabase/`, `src/proxy.ts`).
Application authorization is resolved through the app's `AppUser` model
(`src/lib/auth/current-user.ts`) and permission helpers (`src/lib/auth/authorization.ts`,
`src/lib/auth/guard.ts`).

Do not rely on UI visibility (nav filtering, hidden routes) as an authorization boundary —
`src/app/dashboard/layout.tsx` says this explicitly in its own comment: its redirect is a
"fast-path UX redirect only," and per-page `requirePermission()`/`requireScholarAccess()` calls
are "the real enforcement boundary."

Scholar-level access must continue to be enforced in the server/query layer
(`scholarAccessWhere()` in `src/lib/auth/authorization.ts`, applied inside
`src/lib/dashboard/queries.ts`). Mentors must remain restricted to their assigned scholars
(`CurrentUser.assignedScholarIds`) unless an approved product and security decision changes
that behavior.

Authentication and authorization changes require an ADR. See `docs/SECURITY.md`,
`docs/adr/003-supabase-auth-and-app-user.md`, `docs/adr/004-role-and-scholar-access-control.md`.

---

## Development Process

Before modifying code:

1. Read the relevant feature spec in `specs/` (if one exists for the area you're touching).
2. Inspect the existing implementation.
3. Inspect tests covering the affected behavior.
4. Identify affected domain modules (`src/lib/*`).
5. Explain the intended approach.
6. Identify any architectural consequences (does it touch an ADR-governed decision?).

Prefer small, focused changes. Do not bundle unrelated refactors into feature work.

---

## Feature Specs

Meaningful product changes should have a spec. Specs live under `specs/active`, `specs/planned`,
`specs/completed` — see `specs/README.md` for the lifecycle and required sections.

Do not treat implementation details as product requirements unless they are deliberate
architectural constraints (e.g. "must reuse `scholarAccessWhere()`" is a real constraint; "must
use a `Map` instead of an object" usually isn't).

---

## Architecture Decisions

Create or update an ADR (`docs/adr/`) when a change affects:
- authentication or authorization;
- persistence architecture;
- canonical identifiers;
- external integrations (Supabase, the Sheets/Apps Script sync pipeline, JotForm);
- public/internal API contracts (`src/app/api/**`);
- data ownership or authoritative sources (risk classification is the standing example —
  see `docs/adr/006-authoritative-monthly-risk.md`, and do not "simplify" it by re-deriving
  risk from GPA/check-ins; that was tried and deliberately abandoned);
- core dependencies;
- application-wide routing conventions;
- deployment architecture;
- major data-import behavior.

Only mark an ADR `Accepted` when the decision is already implemented and clearly established, or
has documented human approval. Use `Proposed` for new decisions requiring approval. See
`docs/adr/README.md`.

---

## Implementation Rules

During implementation:
- reuse existing domain logic (check `src/lib/*` before writing a new parser/query);
- do not duplicate business rules inside UI components;
- do not fabricate real program data;
- preserve backward compatibility unless the spec explicitly changes it;
- preserve existing route behavior unless the spec explicitly changes it;
- keep filters URL-addressable (`src/lib/dashboard/filters.ts::parseFilters`/`preserveParams`) —
  this is the pattern every dashboard page and list-to-profile link relies on;
- use existing design tokens (`src/app/globals.css`) rather than hardcoded colors — see
  `docs/DESIGN_SYSTEM.md`;
- avoid new dependencies unless necessary;
- avoid abstractions that have only one trivial use case.

---

## Bug Fix Workflow

When practical:
1. reproduce the bug;
2. add a failing regression test;
3. implement the smallest correct fix;
4. confirm the regression test passes;
5. run the broader relevant suite (`npm test`, and `npm run test:integration` if the change
   touches Prisma-backed behavior).

Do not change expected test behavior merely to make a failing implementation pass.

---

## Validation

Before declaring implementation work complete, run the applicable checks.

Baseline:
```bash
npm run lint
npm test
npm run build
```

For data import, Prisma behavior, or database-backed changes, also run:
```bash
npm run test:integration
```
(requires Docker Postgres — `docker compose up -d` — and `TEST_DATABASE_URL` set; the global
setup drops/recreates that database and runs `prisma migrate deploy` against it).

Use other repository-specific checks when relevant:
```bash
npm run dashboard:check      # runs every dashboard query against the seeded data
npm run data-quality:scan    # runs the data-quality checks and prints/persists issues
```

Do not claim a check passed unless it was actually run successfully. If an environment
limitation prevents a check from running, report that explicitly.

---

## Documentation

Update documentation when behavior changes. Use:
- `README.md` for repository orientation;
- `docs/PRODUCT.md` for product intent and workflows;
- `docs/ARCHITECTURE.md` for system architecture;
- `docs/DATA_MODEL.md` for persistence concepts;
- `docs/SECURITY.md` for auth and access control;
- `docs/DEVELOPMENT.md` for development workflow;
- `docs/DESIGN_SYSTEM.md` for visual conventions;
- `docs/adr/` for architecture decisions;
- `specs/` for feature-level requirements.

Do not use the README as the only source of project knowledge — it is deliberately an entry
point, not the architecture document.

---

## Definition of Done

A task is not complete until:
- acceptance criteria are satisfied;
- relevant tests pass;
- lint passes;
- build passes when applicable;
- authorization implications have been reviewed;
- data implications have been reviewed;
- relevant documentation has been updated;
- known limitations are reported.

Never claim functionality works without verification.
