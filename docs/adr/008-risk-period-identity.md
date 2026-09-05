# ADR-008 — Risk Period Identity Across Semesters

Status: Proposed
Date: 2026-09-04

## Context

`RiskAssessment` is keyed `@@unique([scholarId, period])`, where `period` is a bare string —
either a program-month label (`"MES 3"`) or, when that label is blank, a calendar month
(`"2026-06"`) via `reportingMonthFor()`'s fallback. Neither form carries a semester component.

This has three concrete, already-documented consequences:

1. **Same program month, different semester, same key.** `"MES 3"` in semester `2026-1` and
   `"MES 3"` in semester `2026-2` collide on the same unique key — whichever import runs later
   silently overwrites the earlier semester's risk row. Documented in
   `docs/prototype-comparison.md` ("Known defects this pass surfaced but did not fix"),
   `docs/PRODUCT.md`, `docs/adr/007-spreadsheet-source-adapters.md`, and the Scholar Profile's
   "Risk History — by Semester" section, which is a standing `PENDING` placeholder for exactly
   this reason.
2. **The sheet's own bare `MONTH` column is unmapped.** Both `apps-script/Normalize.gs`'s
   `MENTOR_REPORT_UNMAPPED_HEADERS_` and `src/lib/data-import/source-contracts/mentor-reports.ts`
   deliberately leave it unmapped: *"ambiguous relationship to reportingMonth/registrationDate/
   sessionDate ... unclear which (if either) is authoritative without checking the sheet owner."*
   As a result, `reportingMonth` falls back to the session date's calendar month for a large
   share of reports (documented as ~36% in a prior audit), which sorts and compares differently
   from a `"MES n"` label.
3. **This blocks a real, requested feature.** The dashboard UX/UI refresh task (SPEC-003) asked
   for a monthly (M1→M6) participation-vs-risk trend graph, scoped to a single semester. Building
   it on the current key would require either merging risk data across semesters (wrong answer)
   or guessing which `period` values belong to which semester (also wrong) — so it stays deferred,
   same call already made for the profile's semester rollup.

## Decision (Proposed — not yet approved)

Two independent, separable fixes:

1. **Add semester to `RiskAssessment`'s identity.** Change the unique constraint from
   `(scholarId, period)` to `(scholarId, semester, period)`, sourcing `semester` from
   `MentorReport.semester` (already synced and reliable — it's a plain sheet column, not derived)
   at commit time (`src/lib/risk/from-mentor-report.ts`, `src/lib/data-import/commit.ts`'s
   `MONTHLY_STATUS` path). This is a Prisma migration: a new non-null column, a new unique
   constraint, and a one-time backfill for existing rows (join back to a `MentorReport` with the
   same `scholarId` + `period` to recover its `semester`, where determinable). No source-sheet
   change needed — this is purely an application-side identity fix.
2. **Clarify and map the sheet's actual `MONTH` column** with the program team — confirm what it's
   actually populated with, and whether it should replace or supplement the current
   `reportingMonth`/session-date-fallback logic. This needs a sheet-owner conversation, not just a
   code change, per ADR-007's non-goals (no guessing at ambiguous source columns).

Recommended sequence: do (1) first — a self-contained code + migration change with no external
dependency, and it closes the "silent overwrite" defect on its own. Evaluate (2) separately once
the sheet owner clarifies the column's meaning; it may turn out to be unnecessary once (1) ships.

## Consequences

- (1) requires an approved Prisma migration — explicitly out of scope for a UI-only task
  (SPEC-003) or the ingestion-adapter refactor (ADR-007); it needs its own reviewed change.
- Until approved and shipped, the following stay deferred, unchanged from today: the M1→M6
  participation-vs-risk trend graph, the Scholar Profile's semester-scoped risk history, and any
  other per-semester risk rollup.
- No behavior change to any already-shipped feature results from writing this ADR.

## Alternatives Considered

Leaving the key as-is and building the trend graph from calendar-month-keyed reports only
(excluding `"MES n"`-labeled ones) was considered as a stopgap — it avoids the migration but only
covers the ~64% of reports that already fall back to a calendar month, understating true
participation/risk for the rest. Rejected as a permanent fix, though it remains an option for a
clearly-labeled partial view if the program needs something sooner than a migration can ship.
