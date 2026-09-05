# Interface comparison — current dashboard vs. `MVP_Dashboard AUGUST 4.html`

Compares the live Beca Tech+ dashboard against the design reference
(`design-reference/MVP_Dashboard AUGUST 4.html`), which supersedes the JULY 2 file the previous
version of this document tracked. The reference is a **design reference only** — its hardcoded
numbers are illustrative and are never copied into production queries. Each element is classified:
**Implemented** · **Adapt** (reuse the idea via existing components/data) · **Unsupported**
(no data source — keep `Pending`/omit) · **Defer** (needs a business decision) · **Reject**
(conflicts with production architecture/accessibility).

## What AUGUST 4 changed

Same shell, same five views, same nav order, same card system. The change is the information
architecture: every view becomes a numbered executive outline, and a new `.exec-table` (black
header, right-aligned numerics, colored summary rows) replaces most chart-style visuals. Goal
vs. actual becomes explicit throughout. Brand tokens gained light/dark stops and the display
face moved to a serif.

**Language.** The reference writes most headings in Spanish. The app stays English — the file is
a layout reference, not a copy deck.

**Targets.** Every `META` row renders `PENDING`. No approved program targets exist, and a
plausible-looking placeholder in a goal row is worse than a visible gap.

## Home

| Design element | Status | Notes |
|---|---|---|
| 1 · Our Scholars — selected vs. active, women by country, cohort×country table | **Implemented** | "selected" = every scholar on record; `ProgramStatus` has no admitted-but-never-started state and the sheet carries only active/withdrawn, so the UI says so rather than inventing a third bucket |
| 2 · Drop Outs — totals and women withdrawn | **Implemented** | |
| 2 · Main reasons for drop out | **Unsupported** | no exit-reason column anywhere; mentor-report reasons cover only the current semester, so they say nothing about earlier leavers |
| 3 · Program Retention — hero KPIs + cohort×country | **Implemented** | retention is over the settled population (active + withdrawn); paused/graduated are not a retention outcome |
| 3 · Retention term by term | **Defer** | `AcademicTerm.enrollmentStatus` cannot carry it: "Not applicable for this semester" means both "had not started" and "already left", future terms are pre-filled, and some withdrawn scholars still read as enrolled. Needs an exit term on `Scholar`, which is a source-sheet change first |
| 4 · Vulnerability tiers | **Defer** | the cross-country reconciliation turns out to be done upstream — one harmonised scale already. What is unsettled is the naming: the design relabels the lowest band "Vulnerable", reversing what that row asserts. Behind `TIER_MAPPING_APPROVED` in `lib/scholars/socioeconomic-tier.ts` |
| 5 · Where Our Scholars Are From | **Implemented** | reads `departmentOrigin` (where they grew up), replacing the by-city chart which read `currentMunicipality` |
| 6 · Program Satisfaction | **Unsupported** | no approved formula or data; the design self-labels it `PROXY` |
| 7 · Retention & Dropout by University | **Implemented** | ranked worst dropout first and colour-banded, per the design's legend |
| 8.1 Academic standing by country | **Implemented** | reads `Scholar.academicProgress`, which was synced but read by nothing. **Not** `AcademicTerm.expectedProgressStatus`/`accumulatedGpa`/`progressPercentage` — those are populated by the manual-upload adapter (`src/lib/data-import/adapters/scholar-general-info.ts`) but still absent from the automated Google Sheets sync's `ACADEMIC_TERM_HEADER_` (`apps-script/Normalize.gs`), so they remain empty on any scholar imported only via the live sync |
| 8.2 English level by country | **Adapt** | the design's A1–C2 table sums to 100%; roughly a quarter of scholars have no level recorded, so ours publishes coverage beside the percentages |
| 8.3/8.4 GPA by cohort per country | **Implemented** | reads `AcademicTerm.gpa`; terms stored as a literal `0` mean "not enrolled" and are excluded with the count published. Colombia /5 and Peru /20 are never blended |
| Narrative intro band, FactStrip | **Reject (dropped by the design)** | the framing moved into the page subtitle and section 1 |

## Early Support (Years 1–2)

| Design element | Status | Notes |
|---|---|---|
| 1 · Scholars in Years 1–2 | **Implemented** | |
| 2.1 Status donut + companion table | **Implemented** | description column reuses `RISK_LEVEL_NOTE` |
| 2.2 Reasons for risk, academic vs psychosocial | **Implemented (newly unblocked)** | `MentorReport.academicAlertType` / `psychosocialAlertType` were already synced and read by nothing. Grouped by `lib/risk/reason-taxonomy.ts`. The two axes overlap for most at-risk scholars, so each table carries its own denominator — they do not sum to the at-risk total, and the UI says so |
| 2.3 Participation by activity and risk tier | **Implemented** | one group-by over the mentor-report counts; every percentage ships with its denominator, because those columns default to zero and a blank report is indistinguishable from a real zero |
| 2.3 M1→M6 trend | **Defer** | risk periods are keyed two ways — the sheet column carrying the first two program months is unmapped, so the fallback keys them to a calendar month. An M1→M6 line would compare unlike periods |
| 2.4 Status per university | **Implemented** | |
| 2.5 Risk level by gender | **Implemented** | now a table, per the design |
| 2.6 Risk by socioeconomic condition | **Implemented (beyond the design)** | the design drops it; kept because whether vulnerability predicts risk is the program's core thesis and nothing else answers it. Confirm with the client |
| Risk level by city | **Reject (dropped by the design)** | 2.4 carries the same signal per university |
| 3 · Academic progress + GPA distribution | **Implemented** | |

## Growth & Development (Years 3–5)

| Design element | Status | Notes |
|---|---|---|
| Headcount + retention fact strip | **Implemented** | now uses the shared `FactStrip` |
| MAKERS program description | **Implemented** | |
| D1–D6 goal-vs-actual metrics | **Unsupported (verified)** | the `MAKERS` and `CONFIDENT ENGLISH` columns on the scholar sheet are entirely empty. Module tags and goal thresholds render; values stay `PENDING` |
| Skills by City / Skills by University | **Unsupported** | same source gap. Kept as pending cards rather than empty tables — a table with headers and no rows implies data that exists but is filtered out |
| Academic progress + GPA distribution | **Implemented** | |

## Scholar Profile

| Design element | Status | Notes |
|---|---|---|
| 1 · Contact prioritisation | **Implemented** | at-risk scholars with email and phone, risk-ordered, on its own route (`/dashboard/scholars`). Access-scoped like every scholar read — this is the one view that puts personal contact details on screen |
| 2 · Search with multi-match list | **Implemented** | existing directory table, on its own route (`/dashboard/scholars/find`). A single match stays a one-row list rather than swapping itself for the profile — the search screen has to survive the click |
| Individual profile as a route | **Implemented (beyond the design)** | `/dashboard/scholars/[scholarId]`, keyed on `Scholar.scholarId`. Both lists link to it with `target="_blank"`, so the list you were working through stays put. Survives refresh and direct URL entry; the design's one-HTML-file prototype has no equivalent |
| Identity & Program, three panels | **Implemented** | Personal / Sociodemographic / Academic, under an avatar + name header |
| Academic performance (GPA trend, snapshot) | **Implemented** | the two chips that both read "Academic Progress" now name what they measure |
| Risk history by semester | **Defer** | `RiskAssessment` is now keyed `(scholarId, semester, period)` (ADR-008), so the identity collision that used to merge semesters is fixed — the rollup UI itself just isn't built yet |
| Monthly detail | **Implemented** | |
| Scholar "Age" | **Reject as stored** | derived from `dateOfBirth` at query time, not a stored field |
| Full Record | **Implemented (beyond the design)** | collapsed behind a `<details>`; holds the only copy of terms, check-ins, mentor reports, requests and financial records |

## Program Ecosystem

| Design element | Status | Notes |
|---|---|---|
| Hero counts + country grouping | **Implemented** | |
| University card: type badge, count chips, cohorts, retention, semester/exam dates | **Implemented** | |
| Operating partners grouped by country, track as a badge | **Implemented** | inverts the previous grouping, per the design |
| University / operator contact | **Unsupported** | no source column; absent rather than eleven pending rows |
| Per-card risk bar, "Evaluation results", "Survey results" | **Reject (dropped by the design)** | unreadable at card width, and risk by university has a dedicated home on Early Support |

## Cross-cutting

- **English UI** — Implemented. `DataTable`'s Spanish default empty state was the last holdout.
- **Design tokens, responsive layout** — Implemented; new UI reuses `ExecTable`, `HeroStat`,
  `FilterChipRow`, `SectionNav`, `TypeBadge`, `CountryGroupTitle` plus the existing primitives.
- **Per-section filter chips** — **Adapt**. The design draws them as controls; they render the
  applied top-bar scope instead, so a card can never disagree with the top bar about what it shows.
- **Authentication / server-side authorization** — Preserved. `SectionNav` is permission-aware and
  skips views a role cannot open, rather than linking them to Access denied.
- **No embedded HTML / second dashboard** — the reference is not served; only its interface ideas
  are adapted.

## Known defects this pass surfaced but did not fix

Deferred deliberately (see the plan): GPA and progress fields absent from the sheet sync's
`ACADEMIC_TERM_HEADER_`; the unmapped bare `MONTH` column; and `parseFilters` rejecting `"MES n"`
periods. `RiskAssessment`'s two-column unique key overwriting across semesters is now **fixed**
(ADR-008, `docs/adr/008-risk-period-identity.md`) — the identity is trustworthy, though the
semester-scoped views built on top of it (M1→M6 trend, profile risk-history rollup) remain
deferred.
