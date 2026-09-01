# ADR-002 — Normalized PostgreSQL Model

Status: Accepted
Date: 2026-09-01 (documenting an already-established decision; reflected in the schema since its
initial migration)

## Context

The program's source data lives in wide, hand-maintained Google Sheet tabs (`SCHOLAR GENERAL
INFO`, `MENTOR REPORTS`, `SUPPORT ACTIVITY LOG`) — one row per scholar, with columns repeated
per term/month, per `docs/reference-data-audit.md`. That shape is convenient for manual editing
but not for a dashboard that needs to query "this scholar's risk trend across periods" or "all
scholars behind pace this term" efficiently and unambiguously.

## Decision

The application stores program data as normalized PostgreSQL entities (`prisma/schema.prisma`)
instead of persisting the source spreadsheet's wide structure directly. Time-varying data becomes
its own model, one row per scholar per period: `AcademicTerm` (per term), `MentorReport` and
`RiskAssessment` (per period), `SupportActivity` (per period + activity type). Each references
the scholar via `scholarId` (ADR-001).

## Consequences

- Longitudinal records become explicit and queryable (e.g. a GPA trend is a simple ordered read
  of `AcademicTerm` rows, not column-parsing across a wide sheet).
- Queries become domain-specific — `src/lib/dashboard/queries.ts` and the other `src/lib/*`
  domains read typed, normalized models rather than a generic row/column structure.
- Import/normalization complexity increases: the Apps Script `Normalize.gs` step and
  `src/lib/data-import`'s adapters/validators exist specifically to bridge the wide source shape
  into this normalized model — see `docs/sync-contract.md` and `docs/reference-data-audit.md`.
- Source mapping must remain documented (`docs/sync-contract.md`, `docs/reference-data-audit.md`,
  and the field-level comments in `prisma/schema.prisma` itself, e.g. *"Academic Progress
  (SCHOLAR GENERAL INFO col AR)"*) — a normalized model without a maintained mapping back to the
  source columns becomes unauditable.
- The database model should not be reshaped merely to resemble the source spreadsheet more
  closely; normalization is the point, not an artifact to undo.

## Alternatives Considered

No repository evidence of a wide/denormalized schema having been implemented or seriously
attempted — this decision predates the earliest migration this repository has, so no
"alternatives considered" trail exists to cite. Documenting it here is a formalization of an
existing, unchallenged decision, not a record of a debate.
