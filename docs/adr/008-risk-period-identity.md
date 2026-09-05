# ADR-008 — Risk Period Identity Across Semesters

Status: Accepted
Date: 2026-09-05 (supersedes the 2026-09-04 Proposed draft; implemented in this change)

## Context

`RiskAssessment` was keyed `@@unique([scholarId, period])`, where `period` is a bare string —
either a program-month label (`"MES 3"`) or, when that label is blank, a calendar month
(`"2026-06"`) via `reportingMonthFor()`'s fallback. Neither form carried a semester component.

This had three concrete, already-documented consequences:

1. **Same program month, different semester, same key.** `"MES 3"` in semester `2026-1` and
   `"MES 3"` in semester `2026-2` collided on the same unique key — whichever import ran later
   silently overwrote the earlier semester's risk row. Documented in
   `docs/prototype-comparison.md`, `docs/PRODUCT.md`, `docs/adr/007-spreadsheet-source-adapters.md`,
   and the Scholar Profile's "Risk History — by Semester" section, a standing `PENDING`
   placeholder for exactly this reason.
2. **The sheet's own bare `MONTH` column is unmapped.** Both `apps-script/Normalize.gs`'s
   `MENTOR_REPORT_UNMAPPED_HEADERS_` and `src/lib/data-import/source-contracts/mentor-reports.ts`
   deliberately leave it unmapped: *"ambiguous relationship to reportingMonth/registrationDate/
   sessionDate ... unclear which (if either) is authoritative without checking the sheet owner."*
   **This remains unresolved by this change** — there is no evidence the program team has
   clarified this column, and this ADR does not claim otherwise. `reportingMonth` (and therefore
   `period`) is unchanged: still the sheet's "¿Qué mes reportas?" value, falling back to the
   session date's calendar month when blank.
3. **This blocked a real, requested feature.** The dashboard UX/UI refresh task (SPEC-003) asked
   for a monthly (M1→M6) participation-vs-risk trend graph, scoped to a single semester. This ADR
   fixes the underlying data identity so that graph — and the profile's semester-scoped risk
   history — can be built later on trustworthy data. **Building either view is explicitly out of
   scope for this change**; only the identity is fixed here.

## Decision

### New identity: `(scholarId, semester, period)`

`RiskAssessment` gained a `semester String?` column; the unique constraint changed from
`(scholarId, period)` to `(scholarId, semester, period)`. `period` is **retained unchanged** — same
field, same value, same computation (via `MentorReport.reportingMonth` and
`programMonthKey()`/`reportingMonthFor()`, both untouched) — it now carries the "which program
month" half of identity, same as always, with `semester` supplying the half that was missing.

**Why `period` was kept instead of renaming it to `programMonth`, and why identity is *not* sourced
from `MentorReport.programMonth`:** `MentorReport.programMonth` is a *different*, calendar-window-
derived field (`src/lib/program-calendar.ts::resolveProgramMonth()`), and its `PROGRAM_CALENDAR`
table has confirmed windows for semester `2026-1` **only** — zero windows exist for `2026-2` (the
semester this change ships in) or any later semester. Using it as an identity source would leave
`programMonth` null for effectively all current and future data until someone manually appends
calendar windows each semester (a data change requiring program-team confirmation, per that file's
own comment) — worse than the bug being fixed. `period` (backed by `reportingMonth`, which always
has a working fallback with no calendar-window dependency) is the field actually reliably populated
today, so it stays the stored/display/identity field for "which program month."

### Source of `semester`

`MentorReport.semester` — the sheet's own `SEMESTER` column (`"2026-1"`), already synced via
`src/lib/data-import/validate.ts::buildMentorReport()` (`gS(row, "semester") ?? derived.semester ??
undefined`) — flows through `src/lib/risk/from-mentor-report.ts::mentorReportToRisk()` into the
`RiskAssessment` it builds. `src/lib/data-import/validate.ts::buildMonthlyStatus()` (the
`MONTHLY_STATUS`/"sheet"-sourced path, confirmed unreachable in production per ADR-007) gained a
matching optional `semester` template column for the same pass-through, with no live-lookup
fallback built for it (disproportionate effort for a dead code path).

### Source of `programMonth` (unchanged)

Unchanged from before this ADR: `MentorReport.reportingMonth`, canonicalized by
`programMonthKey()`. This ADR does not touch that logic.

### Graceful degradation when semester can't be determined

`MentorReport.semester` is genuinely nullable in production: the source contract lists it as
`optional`, not `required`; `apps-script/Normalize.gs` has no bilingual/fallback alias for it; and,
per the `PROGRAM_CALENDAR` gap above, the calendar-derived fallback does not work for the current
semester at all. Three integration test fixtures already exercised mentor reports with no
country/semester data, expecting a real `RiskAssessment` row.

Given that, `mentorReportToRisk()`'s null-guard was **deliberately left unchanged**
(`if (!global || !period) return null`) — a report with an unresolvable semester still produces a
classified `RiskAssessment` row, with `semester: null`, rather than being silently dropped. The
alternative (refusing to create a row without a known semester) would trade today's "silent
overwrite across semesters" bug for a worse "silent disappearance from every risk dashboard"
regression, hitting live current-semester data specifically. This is a strict improvement over the
prior behavior: a *known* semester now always disambiguates correctly; only the case where semester
is unknown on *both* sides of a potential collision remains as before.

### Migration and backfill

A single Prisma migration (`prisma/migrations/20260905194810_add_risk_assessment_semester`):

1. Adds nullable `semester TEXT`.
2. Backfills existing rows by joining back to `MentorReport` on `(scholarId, canonicalized period)`
   — using the exact same canonicalization `programMonthKey()` applies in code (including its
   leading-zero-stripping behavior) — but **only** when every matching `MentorReport` row for that
   `(scholarId, period)` agrees on a single, non-blank `semester` (`HAVING COUNT(DISTINCT semester)
   = 1`). Rows with no matching `MentorReport` at all, or with disagreeing reports, are left
   untouched (`semester` stays `NULL`) rather than guessed. Applied against the seeded local dev
   database (973 pre-existing rows), 100% backfilled cleanly to `semester = "2026-1"` — a
   single-semester dataset with no ambiguity. **Production's actual backfill/unresolved counts are
   unknown from this sandbox** — recommend running `SELECT count(*) FILTER (WHERE semester IS
   NULL), count(*) FROM "RiskAssessment"` once, after this deploys, and recording the result.
3. Drops the old 2-column unique index, creates the new 3-column one, plus a supporting
   `(semester, period)` index for semester-scoped dashboard filtering.

No down migration — consistent with every prior migration in this repo (all forward-only). This is
the first hand-edited migration in the repo's history (all 11 prior ones are unedited
Prisma-generated diffs); its SQL says so in a leading comment.

### Backward compatibility and the accepted `NULL`-uniqueness gap

Because `semester` is nullable and part of the unique index, Postgres never treats two
`semester IS NULL` rows as conflicting (`NULL ≠ NULL` for uniqueness purposes). Any row that ends up
with `semester = NULL` — an unresolved legacy row, or a newly-ingested report whose semester
genuinely couldn't be determined — is not protected against a future duplicate
`(scholarId, NULL, period)` insert. This is accepted, not silently left implicit: it is strictly no
worse than today (where *no* row was protected against cross-semester collision), and every row
with a *known* semester is now fully protected. Closing this residual gap for good would mean either
never leaving `semester` unresolved (impossible without fabricating a value the source data doesn't
provide) or making the column `NOT NULL` with a sentinel — deferred, not attempted here, since it
would require a product decision about what to do with genuinely unresolvable rows.

### Code paths updated

- `src/lib/risk/from-mentor-report.ts::mentorReportToRisk()` — `semester` added to the built row.
- `src/lib/data-import/validate.ts::buildMonthlyStatus()` — `semester` added (optional template
  column).
- `src/lib/data-import/commit.ts` — both `RiskAssessment` upsert paths (`MENTOR_REPORT`,
  `MONTHLY_STATUS`) fold `semester` into their in-batch dedupe key and their `bulkUpsert` conflict
  columns. The dedupe-key change is load-bearing: without it, two same-scholar/same-period reports
  from different semesters collapse to one row in memory before ever reaching the database.
- `src/lib/risk/recompute.ts` — mechanical compile fix only (this file is fully unwired from the
  commit pipeline per ADR-006, with zero live callers and no test coverage); it has no semester
  derivation of its own, so it threads `semester: null` through and uses `findFirst`+`create`/
  `update` instead of the compound-unique `upsert()` shorthand (which cannot express a `null`
  component).
- `prisma/seed.ts` — both the `MentorReport` and `RiskAssessment` seed builders now set
  `semester: "2026-1"`, keeping seed data identity-complete.
- `src/lib/dashboard/queries.ts` — **no functional change.** `getCurrentPeriod()`,
  `currentRiskByScholar()`, and `getMonthlyRiskTrend()` (the live "Monthly Change in Risk Level"
  chart) all remain semester-agnostic, same as before this ADR — a documented, deliberately
  deferred limitation (see Consequences), not a regression introduced here.

## Consequences

- The cross-semester collision/overwrite bug is fixed at the storage layer: two `RiskAssessment`
  rows for the same scholar and program month, in different semesters, now coexist.
- Query-layer "current risk" and trend-chart logic (`getCurrentPeriod`, `currentRiskByScholar`,
  `getMonthlyRiskTrend`) remain semester-agnostic by design — fixing them requires a new semester
  filter dimension threaded through `DashboardFilters`/the URL/UI, a product/UI surface change out
  of scope here. `RiskAssessment.semester` now exists and is populated, so that future work is
  unblocked at the data layer, not blocked on a schema question anymore.
- The M1→M6 trend graph and the Scholar Profile's semester-scoped risk history remain deferred,
  unchanged from before this ADR — this change makes the underlying data trustworthy for them, it
  does not build them.
- The sheet's bare `MONTH` column remains unmapped and unclarified — unchanged, no claim otherwise.
- A residual `NULL`-semester uniqueness gap is accepted for rows whose semester can't be determined
  (see above) — strictly no worse than the pre-ADR-008 state, and closable later via a product
  decision if it proves to matter in practice.

## Alternatives Considered

**Sourcing identity from `MentorReport.programMonth` instead of `period`/`reportingMonth`** (the
literal reading of this ADR's original Proposed-status sketch, and of the task's own suggested
`semester + programMonth` field names) — rejected after inspecting `PROGRAM_CALENDAR`: it has
confirmed windows for `2026-1` only, so `programMonth` is null for the entire current semester and
would remain so until manually extended each semester. Adopting it as an identity dimension would
have made most current and future `RiskAssessment` rows unable to disambiguate by program month at
all — a worse outcome than the collision this ADR fixes.

**Refusing to create a `RiskAssessment` row when semester can't be determined** (mirroring the
existing "unrecognized GLOBAL STATUS → no row" pattern) — considered and rejected: `semester` is
optional at the source and has no working fallback for the current semester, so this would have
silently removed scholars from every risk dashboard for as long as their sheet's `SEMESTER` cell
stayed blank — a regression, not a narrower fix. See "Graceful degradation" above.

**Leaving the key as-is and building the trend graph from calendar-month-keyed reports only**
(excluding `"MES n"`-labeled ones) — the original ADR's stopgap alternative. Superseded: this
change fixes the identity directly rather than working around it.
