# Architecture

## System Context

```text
JotForm (placeholder,       Google Sheets (live)                Manual upload
  no live API call)          │                                    (admin UI)
        │                    │ Apps Script, every 10-15 min       │
        │ webhook            │ Normalize.gs → Sync.gs             │
        ▼                    ▼                                    ▼
  POST /api/jotform/webhook  POST /api/sync/import  ◄──────────────┘
        │                            │
        └──────────────┬─────────────┘
                        ▼
          parse → validate → commit  (src/lib/data-import)
                        │
                        ▼
                   PostgreSQL  (Docker Compose locally, Supabase-hosted in prod)
                        │
                        ▼
                Prisma 7 + @prisma/adapter-pg
                        │
                        ▼
       domain/query layer  (src/lib/dashboard, src/lib/risk, src/lib/academic, …)
                        │
                        ▼
              Next.js App Router  (src/app)
                        │
                        ▼
                  Dashboard UI  (src/components)
```

Only the Google Sheets path and manual upload are live ingestion today. The JotForm webhook and
mapper exist in the codebase but are explicitly commented as a placeholder — see "Data
Ingestion" below.

## Application Layer

Next.js 16 App Router, server components by default. Route tree under `src/app`:

```
src/app/
├── layout.tsx, page.tsx (redirects to /dashboard), login/, not-authorized/, auth/callback/
├── api/
│   ├── auth/signout/, jotform/webhook/, sync/import/
│   └── admin/imports/  (list, detail, commit, rollback, template download)
└── dashboard/
    ├── layout.tsx           auth check + nav + TopFilters
    ├── page.tsx              Home
    ├── early-support/        risk + support signals, semesters 1-4
    ├── career-readiness/     semesters 5+
    ├── scholars/              Contact Prioritisation
    ├── scholars/find/         Find a Scholar
    ├── scholars/[scholarId]/  the individual profile
    ├── actors/                Program Ecosystem
    ├── unit-economics/, selection-pipeline/
    ├── admin/imports/, admin/imports/new/, admin/imports/[id]/, admin/data-quality/
    └── {tracking,risk-alerts,academic-progress,support-participation}/   deprecated redirect stubs
```

17 `page.tsx` files (including 4 deprecated redirect stubs kept only so old links still resolve)
plus one `layout.tsx`. 8 route handlers under `src/app/api`.

## Domain Layer

Business logic lives under `src/lib`, one directory per concern — see `AGENTS.md`'s "Repository
Boundaries" for the authoritative list. The dashboard's own query layer,
`src/lib/dashboard/`, is the largest and most-read directory:

| File | Responsibility |
|---|---|
| `queries.ts` | the typed, reusable server-side query layer every page calls; aggregation is done in JS, not SQL, given the dataset's size (~100 scholars) |
| `types.ts` | typed inputs/results for the query layer |
| `filters.ts` | parses `searchParams` into `DashboardFilters`; `preserveParams`/`visiblePillsForPath` — see "Filters" below |
| `views.ts` | single source of truth for the five primary views' order, shared by the sidebar and each page's prev/next `SectionNav` |
| `scholar-routes.ts` | href builders for the three Scholar Profile screens, so both list screens link identically |
| `bands.ts` | risk bands for per-university ranked bars |
| `cohort.ts` | numeric-aware compare over free-text cohort strings |
| `freshness.ts` | data-freshness/staleness logic for the sync-status badge |
| `gender.ts` | normalizes free-text gender values |
| `origin.ts` | reads `departmentOrigin` for the "Where Our Scholars Are From" view |
| `program-month.ts` | numeric ordering for "MES n" program-month labels |
| `risk-tier.ts` | collapses the 5-level risk scale into 3 tiers for summary views |
| `view-helpers.ts` | shared presentation helpers (e.g. risk distribution → chart data) |

## Persistence Layer

PostgreSQL, accessed through Prisma 7 with the `@prisma/adapter-pg` driver adapter (see
`src/lib/db.ts`). Generated client output is customized to `src/generated/prisma` — import from
`@/generated/prisma/client` / `@/generated/prisma/enums`, not the default `@prisma/client` path.
Schema and migrations: `prisma/schema.prisma`, `prisma/migrations/`. See
[DATA_MODEL.md](DATA_MODEL.md).

## Authentication

Supabase Auth with Google sign-in. `src/proxy.ts` (Next.js 16's renamed middleware convention)
refreshes the session cookie and redirects based on session *existence* only — it does not query
Prisma and does not cover `/api/**`. A local-dev-only `DEMO_USER_EMAIL` fallback exists, gated on
`NODE_ENV !== "production"` (deliberately not `VERCEL_ENV`, so it stays inert on Preview too).
See [SECURITY.md](SECURITY.md).

## Authorization

An authenticated Supabase identity is resolved to an `AppUser` row by email
(`src/lib/auth/current-user.ts`); a session with no matching *active* `AppUser` is treated as
"unprovisioned," distinct from "unauthenticated." Role permissions are pure functions over
`CurrentUser` (`src/lib/auth/authorization.ts`) — trivially unit-testable, no I/O. Mentor
scholar-level scoping runs through `scholarAccessWhere()`, applied inside the query layer, not
just the UI. Every dashboard page independently calls `requirePermission()` /
`requireScholarAccess()` (`src/lib/auth/guard.ts`) — the layout's own redirect is documented as a
UX fast-path, not the enforcement boundary. Full detail in [SECURITY.md](SECURITY.md).

## Data Ingestion

Two live paths, both converging on the same `src/lib/data-import` pipeline
(parse → validate → commit → `runDataQualityScan`):

1. **Google Sheets sync** (the dominant path) — `apps-script/Normalize.gs` cleans the program's
   three hand-maintained tabs into four hidden `NORMALIZED_*` tabs; `apps-script/Sync.gs` posts
   each as CSV to `POST /api/sync/import` on a 10–15 minute trigger. Authenticated via a static
   `x-api-key` (`SHEETS_SYNC_API_KEY`), guarded by a DB-backed `SyncLock` against concurrent
   runs, and **auto-commits** — no human review step. See `apps-script/README.md` and
   `docs/sync-contract.md` for the field-level contract (note: that document predates the
   Aug 2026 switch to ingested risk — see `docs/adr/006-authoritative-monthly-risk.md`).
2. **Manual admin upload** — the same pipeline, triggered from `/dashboard/admin/imports/new`,
   with an explicit review-then-commit step and a rollback path
   (`src/lib/data-import/service.ts::rollbackImportBatch`, insert-only, keyed off
   `DataImportBatch.insertedRefs`).

`src/lib/jotform/` and `POST /api/jotform/webhook` are a **placeholder**: the code accepts a
normalized payload shape and has no outbound call to the live JotForm API anywhere in the repo.

## Dashboard Query Layer

UI components consume the typed query/domain layer (`src/lib/dashboard/queries.ts` and friends)
rather than embedding business rules. Server components call these functions directly (no
client-side data fetching for dashboard data); the one `"use client"` data-adjacent component is
`TopFilters`, which only manipulates the URL.

## Filters

Dashboard filters are URL-addressable: `parseFilters(searchParams)` builds a typed
`DashboardFilters`, `preserveParams()` carries the current filters across navigation (including
into the new-tab links from Contact Prioritisation / Find a Scholar to a scholar's profile), and
`visiblePillsForPath()` decides which filter pills a given route shows. This is why filters
survive a page reload, a "next view" hop, or opening a scholar's profile in a new tab.

## Deployment

Vercel (app hosting) + Supabase (Postgres + Auth) in Preview/Production; local development uses
`docker-compose.yml` (a single `postgres:16-alpine` service, host port 5433, container name
`becatech-db`). The build script (`npm run build`) runs `prisma migrate deploy` only when
`VERCEL_ENV=production` — Preview builds skip migrations against the shared database. See
[DEVELOPMENT.md](DEVELOPMENT.md).

## Architectural Boundaries

- UI should not own business rules — they belong in `src/lib`.
- Authorization must be server-side — UI hiding is a convenience, not a boundary.
- Schema changes use migrations — never hand-edit the database.
- Source-of-truth decisions (canonical id, risk source, auth model) belong in ADRs
  (`docs/adr/`), not in scattered code comments alone.
- Existing route compatibility should be preserved unless deliberately changed — deprecated
  routes redirect rather than 404 (see the four redirect stubs under `src/app/dashboard/`).
