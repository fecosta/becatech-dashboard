# Beca Tech+ Scholars Progress Dashboard — Product

## Purpose

The Beca Tech+ Scholars Progress Dashboard is a decision-support application for monitoring
scholars and program performance. Its purpose is to help program teams identify where attention
is required, understand scholar progress over time, prioritize support, and monitor operational
performance.

Technical architecture: see [ARCHITECTURE.md](ARCHITECTURE.md).

## Primary Users

Six roles exist in the codebase (`UserRole` in `prisma/schema.prisma`, permissions in
`src/lib/auth/authorization.ts`):

- **Executive** — program-wide health: Home, Early Support, Growth & Development, Scholar Profile,
  Program Ecosystem, Unit Economics, Selection Pipeline.
- **Program Manager** — the same tracking views as Executive, plus read-only visibility into
  import history (`VIEW_IMPORTS`).
- **Mentor** — Home and the four scholar-tracking views (Early Support, Growth & Development,
  Scholar Profile, Program Ecosystem), scoped to their own assigned scholars only
  (`UserScholarAccess`). Also has `VIEW_SENSITIVE_NOTES`.
- **Analyst/Admin** — the superset: every tracking view, Unit Economics, Selection Pipeline, and
  full import management (`VIEW_IMPORTS` + `MANAGE_IMPORTS` + `MANAGE_DATA`).
- **Finance** — Home and Unit Economics only.
- **Selection Team** — Home and Selection Pipeline only.

See [SECURITY.md](SECURITY.md) for the full role × permission table.

## Core Product Areas

### Home
Program-level monitoring and executive attention: KPI rows, program health (risk + pace),
executive attention callouts.

### Early Support
Scholars in their earlier program years (semesters 1–4). Risk and support-participation signals,
alert-type breakdowns, pace-vs-plan chips.

### Growth & Development
Scholars in later program years (semester 5+). Progress toward graduation/professional
readiness; several Professional-Skills KPIs are explicit pending placeholders (no data source
yet — see Out of Scope below).

### Scholar Profile
Three dedicated screens sharing one sidebar entry:
1. **Contact Prioritisation** (`/dashboard/scholars`) — scholars at medium risk or above,
   highest risk first, with how to reach them (the one view that surfaces personal contact
   details on screen).
2. **Find a Scholar** (`/dashboard/scholars/find`) — search by name, ID, or university over the
   full scholar directory.
3. **Individual Scholar Profile** (`/dashboard/scholars/[scholarId]`) — the full record for one
   scholar, addressed by their canonical `scholarId`. Opened in a new browser tab from either
   list screen above, so the list is never lost.

### Program Ecosystem
Universities and delivery partners/operators, grouped by country. University/operator contact
details are not currently tracked (no source column) — shown as absent, not as pending rows.

### Unit Economics
Cost per active/retained scholar, by cohort/country/university.

### Selection Pipeline
Candidate progression through the selection process (`SelectionCandidate` /
`SelectionStageHistory`), a linear stage machine from application received through to selected,
rejected, or withdrawn.

### Administration
- **Data Imports** — manual upload + review + commit workflow for scholar/academic/mentor-report
  data, plus rollback of a committed batch.
- **Data Quality** — detected data-quality issues (missing cohort, orphaned records, invalid GPA
  values, unmapped program months, duplicate submissions, etc.), scanned automatically on every
  import commit and rollback.

## Main Product Flow

The narrative flow used by the dashboard, shared by the sidebar and each page's prev/next
footer (`src/lib/dashboard/views.ts`):

**Home → Early Support → Growth & Development → Scholar Profile → Program Ecosystem**

Secondary tools: Unit Economics, Selection Pipeline.
Administrative tools: Data Imports, Data Quality.

## Data Sources

- **Google Sheets, via a bound Apps Script** — the program's three hand-maintained sheet tabs
  (`SCHOLAR GENERAL INFO`, `MENTOR REPORTS`, `SUPPORT ACTIVITY LOG`) are normalized into four
  hidden tabs by `apps-script/Normalize.gs`, then pushed as CSV to `POST /api/sync/import` by
  `apps-script/Sync.gs` on a 10–15 minute timer. This is the live, automated ingestion path
  today.
- **Manual spreadsheet/Excel upload** — the same parse → validate → commit pipeline is available
  through the Data Imports admin screen, for one-off or corrective imports.
- **JotForm** — a webhook endpoint (`POST /api/jotform/webhook`) and mapping logic exist in the
  codebase, but this is explicitly a placeholder: there is no live call to the JotForm API
  anywhere in the app. Treat it as scaffolding, not an active data source.
- **PostgreSQL**, via Prisma — the system of record the dashboard reads from. See
  [DATA_MODEL.md](DATA_MODEL.md).

## Product Principles

- **Longitudinal scholar monitoring** — data is normalized into time-specific, domain-specific
  records rather than mirroring the source spreadsheet's wide, point-in-time shape.
- **Canonical scholar identity** — every record ties back to `scholarId` (`ID_becario`); see
  `docs/adr/001-canonical-scholar-identifier.md`.
- **Explicit risk and data-quality signals** — risk is ingested from the program's own
  classification, not silently recalculated (`docs/adr/006-authoritative-monthly-risk.md`); a
  scan surfaces data-quality issues rather than letting bad rows fail silently.
- **Role-appropriate access** — enforced server-side, not just by hiding UI (`docs/SECURITY.md`).
- **No silent fabrication of missing program data** — unsupported metrics render `PENDING` or are
  omitted, never filled with a plausible-looking placeholder.
- **Source coverage should be visible where relevant** — e.g. the English-level KPI publishes
  what fraction of scholars have no level recorded, rather than only the percentages that do.
- **Operational decisions should be traceable to source data** — import batches record what was
  inserted (for rollback) and what was rejected (for review).

## Out of Scope / Not Yet Complete

Pulled from the ongoing design-vs-implementation audit in
[prototype-comparison.md](prototype-comparison.md); see that document for the full list and
rationale per item.

- **Main reasons for drop-out** and **retention term by term** — no exit-reason or exit-term
  field exists on `Scholar` yet; needs a source-sheet change first.
- **Vulnerability tiers** — the tier mapping exists but is behind an unapproved flag
  (`TIER_MAPPING_APPROVED` in `src/lib/scholars/socioeconomic-tier.ts`) pending a naming decision.
- **Program Satisfaction** — no approved formula or data source; shown as `PROXY`.
- **M1→M6 risk trend** — deferred; risk periods are keyed two different ways (program month vs.
  calendar-month fallback), so a straight trend line would compare unlike periods.
- **D1–D6 goal-vs-actual metrics, Skills by City/University** — the underlying `MAKERS` and
  `CONFIDENT ENGLISH` sheet columns are entirely empty; module tags and thresholds render, values
  stay `PENDING`.
- **Risk history by semester** — `RiskAssessment` is now keyed `(scholarId, semester, period)`
  (ADR-008), so the collision that used to merge semesters is fixed at the data layer; the
  per-semester rollup UI itself just isn't built yet.
- **University/operator contact details** — no source column.
- **Every `META`/target row** — no approved program targets exist yet; renders `PENDING` rather
  than a guessed number.

This list reflects deliberate, documented gaps — not a roadmap. It changes as source data and
program decisions change.
