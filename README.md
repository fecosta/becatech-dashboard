# Beca Tech Scholars Progress Dashboard

Decision-support dashboard for the **ver+ Beca Tech** program. It centralizes scholar tracking,
risk monitoring, academic progress, support participation, requests, unit economics, and a
selection pipeline into a normalized PostgreSQL database with a Next.js dashboard on top.

The canonical program key is **`ID_becario`**, stored throughout as `scholarId`.

```
JotForm forms → webhook/ingestion → PostgreSQL (Prisma) → dashboard query layer → dashboard UI
```

## Stack

| Layer     | Choice                                           |
| --------- | ------------------------------------------------ |
| Framework | Next.js (App Router) + TypeScript                |
| Database  | PostgreSQL 16                                     |
| ORM       | Prisma 7 (query compiler + `@prisma/adapter-pg`) |
| Styling   | Tailwind CSS v4                                   |
| Charts    | Recharts                                          |
| Tests     | Vitest                                            |
| Local DB  | Docker Compose                                    |
| Auth      | Supabase Auth (Google sign-in)                    |
| Deploy    | Vercel + Supabase (Postgres)                      |

## Prerequisites

- Node.js 20+ (developed on v22)
- Docker Desktop (for the local Postgres)
- npm

## Quick start

```bash
npm install
cp .env.example .env          # defaults already match the docker-compose Postgres
docker compose up -d          # local Postgres on host port 5433
npm run db:generate
npm run db:migrate            # applies migrations
npm run db:seed               # ~100 fake scholars + related records
npm run dev                   # http://localhost:3000  →  /dashboard
```

Optional: `npm test`, `npm run data-quality:scan`, `npm run db:studio`.

## Environment variables

See [`.env.example`](./.env.example).

| Variable                 | Purpose                                                                     |
| ------------------------ | --------------------------------------------------------------------------- |
| `DATABASE_URL`           | Postgres connection used by the app at runtime (Supabase Supavisor transaction pooler, port 6543, `?pgbouncer=true`, in production). |
| `DIRECT_URL`             | Connection used by Prisma Migrate (Supabase Supavisor session pooler, port 5432, in production — not the raw direct host, which is IPv6-only). Locally same as `DATABASE_URL`. |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL, used by Supabase Auth (Google sign-in). Leave unset locally to use `DEMO_USER_EMAIL` instead. |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase publishable API key, paired with the URL above. |
| `DEMO_USER_EMAIL`        | Local-dev-only auth bypass: which seeded demo user the app acts as instead of a real Google sign-in. Inert whenever `NODE_ENV=production` (i.e. never applies on Vercel). |
| `JOTFORM_API_KEY`        | Placeholder — the MVP does not call the live JotForm API.                   |
| `JOTFORM_WEBHOOK_SECRET` | Optional shared secret for the webhook endpoint (skipped when unset).       |
| `TEST_DATABASE_URL`      | Separate database for `npm run test:integration` (created + migrated by the vitest global setup). |

> **Prisma 7 note:** connection URLs are **not** in `schema.prisma`. Prisma Migrate reads the URL
> from [`prisma.config.ts`](./prisma.config.ts) (which loads `.env` via `dotenv`), and the runtime
> client builds a `pg` driver adapter from `DATABASE_URL` in [`src/lib/db.ts`](./src/lib/db.ts).

## Scripts

| Script                       | Description                                            |
| ---------------------------- | ------------------------------------------------------ |
| `npm run dev`                | Start the Next.js dev server.                          |
| `npm run build` / `start`    | Production build / start.                              |
| `npm run lint`               | ESLint.                                                |
| `npm run test`               | Run unit tests (Vitest, no DB).                        |
| `npm run test:integration`   | DB-backed import pipeline tests (needs Docker Postgres). |
| `npm run db:generate`        | Generate the Prisma client.                            |
| `npm run db:migrate`         | Create + apply a dev migration (`prisma migrate dev`). |
| `npm run db:seed`            | Seed demo data (`tsx prisma/seed.ts`).                 |
| `npm run db:reset`           | Drop, re-migrate, and re-seed.                         |
| `npm run db:studio`          | Open Prisma Studio.                                    |
| `npm run dashboard:check`    | Print every dashboard query against the seed.          |
| `npm run data-quality:scan`  | Detect data-quality issues and record them.            |

## Project structure

```
prisma/
  schema.prisma          # 15 models + enums
  migrations/            # Prisma Migrate history
  seed.ts                # reproducible demo seed
src/
  proxy.ts               # session-existence redirect (Next.js 16's renamed middleware.ts)
  app/
    dashboard/           # layout + 8 dashboard routes
    login/                # Google sign-in page
    auth/callback/        # OAuth code-exchange route handler
    not-authorized/        # shown when signed in but no matching AppUser
    api/jotform/webhook/ # placeholder ingestion endpoint
    api/auth/signout/     # sign-out route handler
  components/            # KpiCard, RiskBadge, DataTable, Sidebar, TopFilters, charts,
                          # GoogleSignInButton, SignOutButton…
  lib/
    db.ts                # Prisma client singleton (pg adapter)
    supabase/             # browser/server Supabase client factories + config check
    auth/                # authorization (roles), current-user (3-state result), guards, demo-mode
    dashboard/           # queries + types + filter parsing
    risk/risk.ts         # risk taxonomy + math
    academic/progress.ts # expected-progress classification
    selection/           # stage-transition rules
    jotform/             # ingestion placeholder (types, mapper, processor, webhook)
    data-quality/        # scanner
  scripts/               # dashboard-check, data-quality-scan (tsx dev tools)
tests/                   # authorization, current-user, guard, stage-transitions, risk
```

## Data model

Normalized model (moves the wide Excel master file into longitudinal tables), keyed by `scholarId`:

`Scholar` · `AcademicTerm` · `MonthlyCheckin` · `MentorReport` · `SupportActivity` ·
`ScholarRequest` · `RiskAssessment` · `FinancialInput` · `SelectionCandidate` +
`SelectionStageHistory` · `RawJotformSubmission` · `DataQualityIssue` · `ControlValue` ·
`AppUser` + `UserScholarAccess`.

Notable constraints: `submissionId @unique` on JotForm-sourced tables (dedup); composite uniques
on `AcademicTerm(scholarId,term)`, `RiskAssessment(scholarId,period)`, `ControlValue(category,value)`,
`UserScholarAccess(userId,scholarId,accessType)`; scholar → children cascade for clean re-seeds;
`FinancialInput` amounts as `Decimal`, raw payloads as `Json`.

## Risk logic

Official five-level taxonomy (stored as integers 0–4):

| Level         | Value |
| ------------- | ----- |
| `SIN_RIESGO`  | 0     |
| `RIESGO_BAJO` | 1     |
| `RIESGO_MEDIO`| 2     |
| `RIESGO_ALTO` | 3     |
| `CRITICO`     | 4     |

Implemented in [`src/lib/risk/risk.ts`](./src/lib/risk/risk.ts):

- `globalRiskValue = max(academic, psychosocial, participation)`
- `riskChange = currentGlobal − previousGlobal` (null when no previous)
- Change labels: `≤ -2` STRONG_IMPROVEMENT · `-1` IMPROVED · `0` STABLE · `1` WORSENED · `≥ 2` SIGNIFICANT_DETERIORATION
- `alertType` = the dimension(s) driving the max (COMBINED on a tie, NONE at zero)

Expected academic progress ([`src/lib/academic/progress.ts`](./src/lib/academic/progress.ts)),
by actual÷expected ratio: `≥0.90` ON_TRACK · `≥0.75` SLIGHTLY_BEHIND · `≥0.50` BEHIND · else CRITICAL_DELAY.

## Dashboard routes

Navigation follows the program narrative (Inicio → Seguimiento → Actores), with secondary tools
under **Más** and data tools under **Administración**. Labels are Spanish.

| Route                                | Nav item / View                                                 |
| ------------------------------------ | --------------------------------------------------------------- |
| `/dashboard`                         | **Inicio** — program health: KPI rows, Salud del programa (risk + progress), Atención ejecutiva. |
| `/dashboard/tracking?tab=summary`    | **Seguimiento › Resumen** — compact operational KPIs for the selected group. |
| `/dashboard/tracking?tab=years-1-2`  | **Seguimiento › Años 1–2** — placeholder (academic/psychosocial support; pending the program-stage rule). |
| `/dashboard/tracking?tab=years-3-5`  | **Seguimiento › Años 3–5** — placeholder (professional development; pending KPI definitions). |
| `/dashboard/tracking?tab=scholars`   | **Seguimiento › Progreso del becario** — scholar directory (reused `ScholarDirectory`). |
| `/dashboard/scholars`                | Scholar directory (still valid; also surfaced via Progreso del becario). |
| `/dashboard/scholars/[scholarId]`    | Scholar profile — GPA/risk trends + full history tables (mentor-scoped). |
| `/dashboard/actors`                  | **Actores** — placeholder (universities + operators; no fake data). |
| `/dashboard/unit-economics`          | **Más › Costos** — cost per active/retained scholar, by cohort/country/uni. |
| `/dashboard/selection-pipeline`      | **Más › Pipeline de selección** — candidates by stage, conversion. |
| `/dashboard/admin/imports`           | **Administración › Importaciones** — import history + wizard.   |
| `/dashboard/admin/data-quality`      | **Administración › Calidad de datos** — detected `DataQualityIssue`s (issue, source, severity, owner, status, resolution). |

Deprecated routes redirect (preserving filters), landing on their guarded targets:
`/dashboard/risk-alerts` → `?tab=years-1-2`; `/dashboard/academic-progress` and
`/dashboard/support-participation` → `?tab=summary`.

All views share a top filter bar (country · cohort · university · status · risk · period) held in
the URL; the Tracking tabs preserve filters and are shareable links. Data comes from the typed query
layer in [`src/lib/dashboard/queries.ts`](./src/lib/dashboard/queries.ts).

## API routes

| Method / Path                 | Purpose                                                                 |
| ----------------------------- | ----------------------------------------------------------------------- |
| `POST /api/jotform/webhook`   | Placeholder ingestion. Accepts a submission, stores the raw payload, maps it to a table, dedups by `submissionId`, returns `PROCESSED` / `FAILED` / `IGNORED`. |
| `POST /api/admin/imports`     | Data import: parse + validate an uploaded file, return a preview (batch id + counts + row errors). Multipart: `file`, `sourceType`, `entity`. |
| `GET /api/admin/imports`      | List import batches. |
| `GET /api/admin/imports/:id`  | Batch detail + error report. |
| `POST /api/admin/imports/:id/commit`   | Commit a validated batch (upsert → data-quality scan → risk recompute). |
| `POST /api/admin/imports/:id/rollback` | Insert-only rollback of a committed batch. |
| `GET /api/admin/imports/template/:entity` | Download a blank `.xlsx` template for an entity. |
| `POST /api/auth/signout`      | Signs out the current Supabase session (no-op if running in local demo mode). |

Import routes are role-gated: `MANAGE_IMPORTS` (ANALYST_ADMIN) for writes, `VIEW_IMPORTS`
(ANALYST_ADMIN + PROGRAM_MANAGER read-only) for reads. See the Data import section below.

```bash
curl -X POST http://localhost:3000/api/jotform/webhook -H "Content-Type: application/json" \
  -d '{"submissionId":"DEMO-1","formType":"CHECKIN","data":{"scholarId":"BT-CO-002","reportingMonth":"2026-07","academicLevel":"Alto"}}'
```

`formType` may be `CHECKIN`, `MENTOR_REPORT`, or `SCHOLAR_REQUEST` (otherwise inferred from the form
name). No live JotForm credentials are required.

## Authorization

Real auth via **Supabase Auth (Google sign-in)**. [`src/proxy.ts`](./src/proxy.ts) (Next.js 16's
renamed `middleware.ts`) refreshes the session and redirects signed-out visitors from `/dashboard/*`
to `/login`. [`src/lib/auth/current-user.ts`](./src/lib/auth/current-user.ts) resolves the signed-in
Google email to a seeded `AppUser` row and returns one of three states: unauthenticated, signed-in
but not provisioned (redirects to `/not-authorized` — contact an admin to be added), or a resolved
`CurrentUser`. Pure role/permission helpers live in
[`src/lib/auth/authorization.ts`](./src/lib/auth/authorization.ts) (unchanged by the auth rewrite);
pages enforce them via [`guard.ts`](./src/lib/auth/guard.ts), which denies (not allows) whenever
there's no resolved user.

**Local dev without Google OAuth:** set `DEMO_USER_EMAIL` and leave `NEXT_PUBLIC_SUPABASE_URL`
unset — the app acts as that seeded demo user instead. This bypass is inert whenever
`NODE_ENV=production`, so it never applies on a real Vercel deployment (Preview or Production).

| Role             | Access                                                        |
| ---------------- | ------------------------------------------------------------- |
| `EXECUTIVE`      | Dashboard, scholar tracking, unit economics, selection (no sensitive notes). |
| `PROGRAM_MANAGER`| Everything except data management.                            |
| `MENTOR`         | Scholar tracking; profiles limited to **assigned** scholars.  |
| `ANALYST_ADMIN`  | Everything (superset, incl. data management).                 |
| `FINANCE`        | Dashboard + unit economics.                                   |
| `SELECTION_TEAM` | Dashboard + selection pipeline.                               |

In local dev (no Supabase configured), switch roles by editing `DEMO_USER_EMAIL` in `.env` (see demo
users below) and restarting the dev server. Against real deployments, switch roles by signing in with
a different Google account whose email matches a different seeded `AppUser`.

## Demo data & users

`npm run db:seed` clears and repopulates the database (idempotent, fixed RNG — reproducible). All
data is synthetic; no real personal data.

- **Scholars**: 100 — Colombia 60 / Peru 40; cohorts 2024–2026; status Active 82 / Withdrawn 8 /
  Paused 5 / Graduated 5.
- Plus academic terms (~305), check-ins (~346), mentor reports (~340), support activities (~1,968),
  monthly risk assessments (~448), requests (~39), financial inputs (~433), 140 selection candidates
  + stage history (~751), 44 control values, 12 demo users, 100 mentor→scholar access rows.
- Risk distribution ≈ 45 / 25 / 18 / 9 / 3 %; alerts across all dimensions.
- **Deliberate testing seams**: ~7 active scholars with no check-ins and ~20 missing the latest
  month; ~11 low-participation; ~7 high-cost scholars; ~30 with requests.

| Email                                             | Role            | Name            |
| ------------------------------------------------- | --------------- | --------------- |
| `executive@becatech.test`                         | EXECUTIVE       | Ana Restrepo    |
| `program.manager@becatech.test` (default)         | PROGRAM_MANAGER | Carlos Méndez   |
| `program.manager2@becatech.test`                  | PROGRAM_MANAGER | Lucía Fernández |
| `mentor1@becatech.test` … `mentor6@becatech.test` | MENTOR          | (6 mentors)     |
| `analyst@becatech.test`                           | ANALYST_ADMIN   | Diego Ramírez   |
| `finance@becatech.test`                           | FINANCE         | Sofía Torres    |
| `selection@becatech.test`                         | SELECTION_TEAM  | Mateo Gómez     |

## Data import (admin)

An admin panel at **`/dashboard/admin/imports`** (ANALYST_ADMIN in the nav; PROGRAM_MANAGER
read-only) uploads files to create/update scholars and their longitudinal records through one
shared pipeline: **parse → adapter → validate → preview → commit → data-quality scan + risk
recompute**.

- **Two formats** feed the same validate/commit path:
  - **Template** — one entity per file; headers are the Prisma field names (download blank
    `.xlsx` templates from the panel). Supported entities: scholars, academic terms, monthly
    check-ins, mentor reports, support activities, scholar requests, financial inputs.
  - **Legacy wide Excel** — the "SCHOLAR GENERAL INFO" tab; repeating per-term columns
    (`GPA 2024-1`, `CRÉDITOS 2024-1`, …) are detected by regex and normalized into academic-term
    rows (new semesters are picked up automatically).
- **Validation** checks required fields, types, GPA range, controlled values (against
  `ControlValue`), and that each `scholarId` exists (or is created earlier in the same batch).
  Invalid rows are reported per row/field; valid rows still commit (commit-valid).
- **Idempotent**: rows upsert by natural key (`scholarId`, `scholarId+term`, `submissionId`,
  `scholarId+period+activityType+source`), so re-uploading the same file does not duplicate.
  Check-ins/mentor reports/requests without a `submissionId` get a deterministic synthetic one.
- **Risk is never uploaded.** After a batch touches academic terms / check-ins / mentor reports /
  support activities, the risk engine **recomputes** `RiskAssessment` for the affected
  scholars/months (`src/lib/risk/derive.ts` — a documented, tunable heuristic).
- **Rollback** is insert-only: it deletes the rows the batch *created* (tracked via
  `importBatchId` / `insertedRefs`); updates are not reverted.

Integration tests exercise the full pipeline (happy path, legacy `.xlsx`, partial failure,
idempotent re-upload, risk-trigger, rollback): `npm run test:integration` (needs Docker Postgres;
it creates + migrates `TEST_DATABASE_URL`).

## Data quality

[`npm run data-quality:scan`](./src/lib/data-quality/checks.ts) scans the database for the catalogued
issue types (orphan check-ins/reports, invalid GPA/risk, missing reporting month, missing
check-in/mentor report for active scholars, duplicate `submissionId`) and records them in
`DataQualityIssue`. On the seed it finds ~41 issues (the deliberate reporting gaps). Issues that the
schema makes impossible (missing/duplicate scholar id, unknown country) are intentionally skipped.
The scan also runs automatically after every import commit/rollback, and the detected issues are
surfaced in the UI at **Administración › Calidad de datos** (`/dashboard/admin/data-quality`,
read-gated by `VIEW_IMPORTS`).

## Testing

`npm test` runs Vitest over the highest-risk areas (70 tests across 13 files), including:

- `tests/authorization.test.ts` / `tests/import-authz.test.ts` — role access rules.
- `tests/nav-permissions.test.ts` — nav visibility per role after the PES Phase A restructure
  (Finance/Selection excluded from Seguimiento/Actores; the Tracking gate is also the guard the
  deprecated-route redirects land on).
- `tests/tracking.test.ts` — `parseTrackingTab` (unknown → summary) and the filter-preserving
  `preserveParams` redirect/tab URL builder.
- `tests/home-helpers.test.ts` — `normalizeGender` (free-text gender) and `latestCohort` (numeric
  comparator).
- `tests/current-user.test.ts` — the three-state auth result (unauthenticated / unprovisioned / ok),
  the `DEMO_USER_EMAIL` fallback, and mentor `assignedScholarIds` resolution.
- `tests/guard.test.ts` — pins down `guard.ts`'s fail-closed behavior (a null user must always be
  denied, never fail open).
- `tests/stage-transitions.test.ts` — selection stage transitions.
- `tests/risk.test.ts` (+ `tests/risk/derive.test.ts`) — taxonomy, global risk, change labels, alert
  type, and the data-import risk-derivation heuristic.
- `tests/data-import/*.test.ts` — parse/adapter/validation for the import pipeline.

## Deployment (Vercel + Supabase)

1. Provision a Postgres project on [Supabase](https://supabase.com) — either via the
   [Vercel Marketplace integration](https://vercel.com/marketplace/supabase) or a project created
   directly at supabase.com. Use at least the Pro plan for production: the Free plan pauses
   projects after 7 days of inactivity, unsuitable for a live app.
2. From the Supabase dashboard's **Connect** dialog, copy the **Transaction pooler** connection
   string (port 6543) and the **Session pooler** connection string (port 5432).
3. On Vercel set env vars (Production **and** Preview): `DATABASE_URL` = transaction pooler URL +
   `?pgbouncer=true`, `DIRECT_URL` = session pooler URL (not the "Direct connection" string, which
   is IPv6-only and unreachable from Vercel builds), `NEXT_PUBLIC_SUPABASE_URL` /
   `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (Project Settings → API Keys), and optional
   `JOTFORM_WEBHOOK_SECRET`. Do **not** set `DEMO_USER_EMAIL` on Vercel — it only applies locally.
4. Enable the Google provider in Supabase Auth (Authentication → Providers → Google), using a
   Google Cloud Console OAuth client with Authorized redirect URI
   `https://<project-ref>.supabase.co/auth/v1/callback`. In Supabase Auth → URL Configuration, add
   this app's own callback to the redirect allowlist: the production URL
   (`https://becatech-dashboard.vercel.app/auth/callback`) and a wildcard for Preview deployments
   (`https://becatech-dashboard-*-<team-slug>.vercel.app/auth/callback`).
5. Apply migrations during release: `prisma migrate deploy` (uses `DIRECT_URL`).
6. Seed once if desired: export `DATABASE_URL`/`DIRECT_URL` explicitly in your shell first (don't
   rely on `.env`/`.env.local`, which won't override already-set process env vars), then run
   `npm run db:seed` against the provisioned database.
7. Deploy. Dashboard routes are server-rendered on demand (no build-time DB access).

## Assumptions & known limitations

- **Auth** is Supabase Auth (Google sign-in); Google Workspace-specific SSO was not required — any
  Google account works, gated by a seeded `AppUser` row rather than a Workspace domain restriction.
- Unit-economics amounts are normalized to **USD with demo FX rates** (`USD_PER_UNIT` in
  `queries.ts`) — swap for real rates before using cost figures externally.
- The scholar **list**/risk/academic pages are not yet scoped to a mentor's assigned scholars
  (individual profiles are). Pass allowed ids into the query layer to scope them.
- Live JotForm API sync, advanced analytics, and a full intervention workflow are out of MVP scope.
- **Data import:** the risk-derivation heuristic in `src/lib/risk/derive.ts` is a documented
  default meant to be tuned with the program team; insert-only rollback does not revert row
  *updates* nor recomputed risk; the legacy adapter covers the "SCHOLAR GENERAL INFO" tab (other
  wide tabs go through the template path); program-level (no-scholar) financials are not importable.
- **`xlsx` dependency:** the npm-published SheetJS build (0.18.5) carries known advisories; imports
  are restricted to authenticated ANALYST_ADMIN users and every row is validated, but consider
  swapping to `exceljs` if that risk profile is unacceptable.
