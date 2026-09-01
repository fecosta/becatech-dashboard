# Beca Tech+ Scholars Progress Dashboard

Decision-support dashboard for the Beca Tech program. It centralizes scholar tracking, risk
monitoring, academic progress, support participation, requests, program operations, unit
economics, selection, imports, and data quality into a normalized PostgreSQL database with a
Next.js dashboard on top.

Canonical ID: **`ID_becario`** → `Scholar.scholarId` (see
[docs/adr/001-canonical-scholar-identifier.md](docs/adr/001-canonical-scholar-identifier.md)).

## Architecture at a Glance

```
Google Sheets (Apps Script, live) ──┐
Manual admin upload ─────────────────┼─► parse/validate/commit ─► PostgreSQL ─► Prisma
JotForm webhook (placeholder) ──────┘                                              │
                                                                                     ▼
                                                          domain/query layer (src/lib/*)
                                                                                     │
                                                                                     ▼
                                                    Next.js App Router ─► Dashboard UI
```

Full detail: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 16.2.10 (App Router), React 19.2.4, TypeScript |
| Database | PostgreSQL 16, Prisma 7.8.0 + `@prisma/adapter-pg` |
| Auth | Supabase Auth (Google sign-in) |
| Styling | Tailwind CSS 4 (CSS-based config, tokens in `src/app/globals.css`) |
| Charts | Recharts |
| Testing | Vitest (unit + integration) |
| Deploy | Vercel + Supabase; local Postgres via Docker Compose |

## Quick Start

```bash
npm install
cp .env.example .env      # fill in DATABASE_URL, Supabase keys — see docs/DEVELOPMENT.md
docker compose up -d      # Postgres on host port 5433
npm run db:generate
npm run db:migrate
npm run db:seed
npm run dev
```

Full setup, environment variables, and every `npm run` script:
[docs/DEVELOPMENT.md](docs/DEVELOPMENT.md).

## Main Product Areas

- **Home** — program-level monitoring and executive attention
- **Early Support** — scholars in semesters 1–4, risk and support signals
- **Career Readiness** — scholars in semester 5+, progress toward graduation
- **Scholar Profile** — Contact Prioritisation, Find a Scholar, and the individual profile
  (`/dashboard/scholars`, `/dashboard/scholars/find`, `/dashboard/scholars/[scholarId]`)
- **Program Ecosystem** — universities and delivery partners
- **Unit Economics** — cost per active/retained scholar
- **Selection Pipeline** — candidate progression
- **Admin** — Data Imports, Data Quality

Product detail and per-role access: [docs/PRODUCT.md](docs/PRODUCT.md).

## Repository Structure

```
src/
├── app/            Next.js App Router — pages under dashboard/, API routes under api/
├── components/     reusable UI (server components by default)
├── lib/            domain logic — auth, dashboard queries, risk, academic, selection,
│                   data-import, data-quality, jotform (placeholder)
└── generated/      the Prisma client (customized output path)
prisma/             schema.prisma + migrations
apps-script/        Google Sheets sync scripts (Normalize.gs, Sync.gs) — deployed manually,
                    not via git push; see docs/DEVELOPMENT.md
tests/              unit tests (tests/**) + integration tests (tests/integration/**)
docs/               architecture, data model, security, design system, ADRs
specs/              feature specs (active / planned / completed)
```

## Development Commands

| Command | Purpose |
|---|---|
| `npm run dev` | start the dev server |
| `npm run build` | production build |
| `npm run lint` | ESLint |
| `npm test` | unit tests |
| `npm run test:integration` | DB-backed integration tests (needs Docker Postgres) |
| `npm run db:migrate` | create + apply a Prisma migration |
| `npm run db:seed` | seed mock demo data |
| `npm run db:studio` | browse the database |
| `npm run dashboard:check` | run every dashboard query against seeded data |
| `npm run data-quality:scan` | run data-quality checks |

Full command list: [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md).

## Documentation

- [docs/PRODUCT.md](docs/PRODUCT.md) — what the product is, for whom
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — how the system is structured
- [docs/DATA_MODEL.md](docs/DATA_MODEL.md) — how program information is persisted
- [docs/SECURITY.md](docs/SECURITY.md) — authentication, roles, access control
- [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) — local setup, commands, testing, workflow
- [docs/DESIGN_SYSTEM.md](docs/DESIGN_SYSTEM.md) — tokens and visual conventions
- [docs/adr/](docs/adr/README.md) — architecture decision records
- [specs/](specs/README.md) — feature specs
- [docs/prototype-comparison.md](docs/prototype-comparison.md) — design mockup vs. implementation
  audit
- [docs/reference-data-audit.md](docs/reference-data-audit.md) — source Google Sheet field
  inventory
- [docs/sync-contract.md](docs/sync-contract.md) — Sheets → dashboard field contract (note: this
  document predates the 2026-08-06 switch to ingested risk classification — see
  [docs/adr/006-authoritative-monthly-risk.md](docs/adr/006-authoritative-monthly-risk.md) for
  the current, authoritative behavior)
- [AGENTS.md](AGENTS.md) — operational contract for AI coding agents working in this repo

## Development Workflow

Spec (`specs/`, for anything beyond a small fix) → inspect existing implementation → implement →
test → review the diff → update documentation → move the spec to `specs/completed/`. Full detail
in [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md); operational rules for AI agents in
[AGENTS.md](AGENTS.md).

## Status / Known Incomplete Areas

Several design elements are deliberately unimplemented pending a data or product decision rather
than filled with placeholder numbers — see
[docs/PRODUCT.md](docs/PRODUCT.md#out-of-scope--not-yet-complete) and
[docs/prototype-comparison.md](docs/prototype-comparison.md) for the current list and rationale
(e.g. Program Satisfaction, retention term-by-term, D1–D6 MAKERS goal metrics, university/operator
contact details).

## License / Ownership

Private repository (`"private": true`); no separate license is published.
