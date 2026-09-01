# ADR-006 — Authoritative Monthly Risk Source

Status: Accepted
Date: 2026-09-01 (documenting a decision made in commit `8d748cd`, 2026-08-06)

## Context

Between the schema's initial migration and 2026-08-06, the dashboard computed a scholar's risk
classification itself — a derive engine (`src/lib/risk/derive.ts`, `src/lib/risk/recompute.ts`)
inferred academic, psychosocial, and participation risk from GPA, check-ins, mentor free-text
labels, and activity counts, then combined them into a global risk value.

This did not work. Per the commit that replaced it (`8d748cd`, quoted verbatim): *"Our derived
engine could never reproduce the program's official numbers (and couldn't work anyway: GPA is
100% empty and the mentor status vocabulary never matched the keyword logic)."* Meanwhile, the
program's own MENTOR REPORTS sheet already computes a per-report classification — column Y,
"GLOBAL STATUS" — from the mentor's academic and psychosocial status. The dashboard was already
syncing that column into `MentorReport.mentorReportedGlobalStatus`, but the field was
**quarantined**: an explicit prior schema comment stated *"this field must never feed into
RiskAssessment.globalRiskValue/globalRiskLevel"* (superseded — see Decision).

## Decision

Global risk is **ingested from the program's own stored classification, never derived by the
application**. Two coexisting ingestion paths write directly to `RiskAssessment` on import
commit:

1. **`MentorReport.mentorReportedGlobalStatus`** ("GLOBAL STATUS," MENTOR REPORTS column Y) →
   `src/lib/risk/from-mentor-report.ts::mentorReportToRisk()` → a `RiskAssessment` row with
   `source: "mentor-report"`, keyed by `MentorReport.reportingMonth` (the `MES n` program-month
   label when present; falling back to the session date's `YYYY-MM` via `reportingMonthFor()` in
   `src/lib/data-import/validate.ts` when the sheet's "¿Qué mes reportas?" column is blank).
2. **The `MONTHLY_STATUS` import entity** (fed from the SUPPORT ACTIVITY LOG's own sheet-computed
   classification) → `src/lib/data-import/validate.ts::buildMonthlyStatus()` → a `RiskAssessment`
   row with `source: "sheet"`.

Both paths use `parseRiskClassification()` (`src/lib/risk/classification.ts`), a controlled
Spanish → `RiskLevel` mapping that **rejects** unrecognized values rather than guessing — a
blank or unrecognized classification produces no `RiskAssessment` row at all (the scholar-month
is simply unclassified, matching what the sheet itself shows).

The current schema comment on the authoritative field states this plainly:

> GLOBAL STATUS (col Y on the sheet): the program's computed per-report risk classification
> (RIESGO …). This is the AUTHORITATIVE risk source — on commit it maps to a RiskAssessment
> (src/lib/risk/from-mentor-report.ts), keyed by the program month. Global risk is ingested, not
> derived.

The old derive engine (`derive.ts`, `recompute.ts`) is **retained in the codebase, still unit
tested, but intentionally unwired from the commit pipeline** — `src/lib/data-import/service.ts`
hardcodes `recomputed = 0` with the comment *"Risk is no longer derived — global risk is
INGESTED... No import recomputes risk anymore; the derive engine... is retained but
intentionally unwired here."*

## Consequences

- **An AI agent must not "simplify" this by recalculating risk from GPA, check-ins, or activity
  counts.** That approach was implemented, shipped, and deliberately abandoned for a documented
  reason (it could not reproduce the program's official numbers, and its inputs were frequently
  empty). Reintroducing derivation — even as a "cleanup" or "consistency" fix — would silently
  diverge the dashboard from the program's own numbers again.
- Changing the source of authoritative risk (which sheet column, which entity, whether to revive
  derivation for any dimension) requires a new ADR, not a code-review-level change.
- `RiskAssessment` has no `importBatchId` and is not insert-rollback-tracked (see
  `docs/DATA_MODEL.md`) — rolling back an import does not revert risk; the next sync overwrites
  it with current source values, because these rows are a mirror of the sheet, not
  independently-owned application state.
- The two ingestion paths can disagree (different source columns, potentially different periods)
  — this is accepted, not a bug to reconcile silently; each row's `source` field records which
  path produced it.
- `RiskAssessment.assessmentComplete`/`missingInputs` (the "Insufficient Data, never inferred
  CRITICO" completeness semantics documented in `prisma/schema.prisma`) currently always read as
  complete under both ingestion paths, since a classified scholar-month is treated as complete by
  definition. This machinery matters again only if the derive engine is ever deliberately
  re-wired — which requires a new ADR, per above.

## Alternatives Considered

The retired derive engine (`src/lib/risk/derive.ts`, `src/lib/risk/recompute.ts`) is the one
real, previously-implemented alternative, per the git history (commit `8d748cd`, 2026-08-06):
computing academic/psychosocial/participation risk from GPA, check-in and mentor free-text
labels, and support-activity counts, then combining them into a global value. It was replaced,
not merely proposed, because it could not reproduce the program's official numbers and several of
its inputs were empty in the actual source data.

## Note on related documentation

`docs/sync-contract.md` predates this decision by two days (written 2026-08-04) and still
describes the retired approach — it says risk fields *"feed the derived risk engine"* and that
`mentorReportedGlobalStatus` is *"quarantined — never used by risk derivation."* Both statements
are now incorrect. This ADR is authoritative for risk sourcing; `docs/sync-contract.md` should be
corrected in a separate, focused change (see the organizational-review follow-up
recommendations).
