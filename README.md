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
| Deploy    | Vercel + Neon / Vercel Postgres                   |

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
| `DATABASE_URL`           | Postgres connection used by the app at runtime (pooled URL in production).  |
| `DIRECT_URL`             | Direct (non-pooled) connection used by Prisma Migrate. Locally same as above. |
| `DEMO_USER_EMAIL`        | Mock auth: which seeded demo user the app acts as during the MVP.           |
| `JOTFORM_API_KEY`        | Placeholder — the MVP does not call the live JotForm API.                   |
| `JOTFORM_WEBHOOK_SECRET` | Optional shared secret for the webhook endpoint (skipped when unset).       |

> **Prisma 7 note:** connection URLs are **not** in `schema.prisma`. Prisma Migrate reads the URL
> from [`prisma.config.ts`](./prisma.config.ts) (which loads `.env` via `dotenv`), and the runtime
> client builds a `pg` driver adapter from `DATABASE_URL` in [`src/lib/db.ts`](./src/lib/db.ts).

## Scripts

| Script                       | Description                                            |
| ---------------------------- | ------------------------------------------------------ |
| `npm run dev`                | Start the Next.js dev server.                          |
| `npm run build` / `start`    | Production build / start.                              |
| `npm run lint`               | ESLint.                                                |
| `npm run test`               | Run Vitest.                                            |
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
  app/
    dashboard/           # layout + 8 dashboard routes
    api/jotform/webhook/ # placeholder ingestion endpoint
  components/            # KpiCard, RiskBadge, DataTable, Sidebar, TopFilters, charts…
  lib/
    db.ts                # Prisma client singleton (pg adapter)
    auth/                # authorization (roles), current-user, guards
    dashboard/           # queries + types + filter parsing
    risk/risk.ts         # risk taxonomy + math
    academic/progress.ts # expected-progress classification
    selection/           # stage-transition rules
    jotform/             # ingestion placeholder (types, mapper, processor, webhook)
    data-quality/        # scanner
  scripts/               # dashboard-check, data-quality-scan (tsx dev tools)
tests/                   # authorization, stage-transitions, risk
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

| Route                                | View                                                            |
| ------------------------------------ | --------------------------------------------------------------- |
| `/dashboard`                         | Executive overview — KPIs, risk distribution, status breakdown. |
| `/dashboard/risk-alerts`             | Risk & alerts — attention list, alert type, missing reports.    |
| `/dashboard/scholars`                | Scholar directory with search.                                  |
| `/dashboard/scholars/[scholarId]`    | Scholar profile — GPA/risk trends + full history tables.        |
| `/dashboard/academic-progress`       | GPA by group, progress status, behind list.                     |
| `/dashboard/support-participation`   | Participation by type/month/risk, low-participation list.       |
| `/dashboard/unit-economics`          | Cost per active/retained scholar, cost by cohort/country/uni.   |
| `/dashboard/selection-pipeline`      | Candidates by stage, conversion, recent applications.           |

All views share a top filter bar (country · cohort · university · status · risk · period) held in
the URL. Data comes from the typed query layer in
[`src/lib/dashboard/queries.ts`](./src/lib/dashboard/queries.ts).

## API routes

| Method / Path                 | Purpose                                                                 |
| ----------------------------- | ----------------------------------------------------------------------- |
| `POST /api/jotform/webhook`   | Placeholder ingestion. Accepts a submission, stores the raw payload, maps it to a table, dedups by `submissionId`, returns `PROCESSED` / `FAILED` / `IGNORED`. |

```bash
curl -X POST http://localhost:3000/api/jotform/webhook -H "Content-Type: application/json" \
  -d '{"submissionId":"DEMO-1","formType":"CHECKIN","data":{"scholarId":"BT-CO-002","reportingMonth":"2026-07","academicLevel":"Alto"}}'
```

`formType` may be `CHECKIN`, `MENTOR_REPORT`, or `SCHOLAR_REQUEST` (otherwise inferred from the form
name). No live JotForm credentials are required.

## Authorization

Mock auth for the MVP: the "current user" is whoever `DEMO_USER_EMAIL` points at
([`src/lib/auth/current-user.ts`](./src/lib/auth/current-user.ts)). Pure role/permission helpers live
in [`src/lib/auth/authorization.ts`](./src/lib/auth/authorization.ts); pages enforce them via
[`guard.ts`](./src/lib/auth/guard.ts). When `DEMO_USER_EMAIL` is unset, access is open (local dev).

| Role             | Access                                                        |
| ---------------- | ------------------------------------------------------------- |
| `EXECUTIVE`      | Dashboard, scholar tracking, unit economics, selection (no sensitive notes). |
| `PROGRAM_MANAGER`| Everything except data management.                            |
| `MENTOR`         | Scholar tracking; profiles limited to **assigned** scholars.  |
| `ANALYST_ADMIN`  | Everything (superset, incl. data management).                 |
| `FINANCE`        | Dashboard + unit economics.                                   |
| `SELECTION_TEAM` | Dashboard + selection pipeline.                               |

Change roles by editing `DEMO_USER_EMAIL` in `.env` (see demo users below) and restarting the dev server.

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

## Data quality

[`npm run data-quality:scan`](./src/lib/data-quality/checks.ts) scans the database for the catalogued
issue types (orphan check-ins/reports, invalid GPA/risk, missing reporting month, missing
check-in/mentor report for active scholars, duplicate `submissionId`) and records them in
`DataQualityIssue`. On the seed it finds ~41 issues (the deliberate reporting gaps). Issues that the
schema makes impossible (missing/duplicate scholar id, unknown country) are intentionally skipped.

## Testing

`npm test` runs Vitest over the two highest-risk areas plus the risk math (21 tests):

- `tests/authorization.test.ts` — role access rules.
- `tests/stage-transitions.test.ts` — selection stage transitions.
- `tests/risk.test.ts` — taxonomy, global risk, change labels, alert type.

## Deployment (Vercel + Neon / Vercel Postgres)

1. Provision Postgres (Neon or Vercel Postgres).
2. On Vercel set env vars: `DATABASE_URL` = **pooled** URL, `DIRECT_URL` = **direct** URL,
   `DEMO_USER_EMAIL` (until SSO lands), and optional `JOTFORM_WEBHOOK_SECRET`.
3. Apply migrations during release: `prisma migrate deploy` (uses `DIRECT_URL`).
4. Seed once if desired: `npm run db:seed` against the provisioned database.
5. Deploy. Dashboard routes are server-rendered on demand (no build-time DB access).

## Assumptions & known limitations

- **Mock auth** only; Google Workspace SSO is deferred. Replace `getCurrentUser` when adding SSO.
- Unit-economics amounts are normalized to **USD with demo FX rates** (`USD_PER_UNIT` in
  `queries.ts`) — swap for real rates before using cost figures externally.
- The scholar **list**/risk/academic pages are not yet scoped to a mentor's assigned scholars
  (individual profiles are). Pass allowed ids into the query layer to scope them.
- Live JotForm API sync, advanced analytics, and a full intervention workflow are out of MVP scope.
