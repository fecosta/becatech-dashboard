# Data Model

Based on `prisma/schema.prisma` (18 models). This is a conceptual guide, not a schema dump — read
the schema file itself for exact field lists.

## Canonical Identity

`ID_becario`, the program's source identifier for a scholar, is represented as `Scholar.scholarId`:

```prisma
scholarId String @id // maps to ID_becario
```

Every longitudinal record — academic terms, check-ins, mentor reports, support activity,
requests, risk assessments, financial inputs, scholar-user access — carries a `scholarId`
foreign key back to this one row. This is what lets data from different sources and different
points in time be linked to the same scholar reliably; see
`docs/adr/001-canonical-scholar-identifier.md`.

## Core Entities

| Model | Purpose |
|---|---|
| `Scholar` | the core entity — one row per scholar, keyed on `scholarId` |
| `University` | partner institution (`name` unique) |
| `Operator` | delivery partner / operator (`name` unique) |
| `AcademicTerm` | one row per scholar per term — GPA, credits, progress status |
| `MonthlyCheckin` | scholar-submitted wellbeing/status check-in |
| `MentorReport` | mentor-submitted report, including the authoritative risk classification (see `docs/adr/006-authoritative-monthly-risk.md`) |
| `SupportActivity` | counts of support-activity participation by type and period |
| `ScholarRequest` | a scholar's submitted request and its resolution |
| `RiskAssessment` | the per-scholar, per-period risk classification the dashboard reads |
| `FinancialInput` | program/scholar cost line items (the only `Decimal` field in the schema) |
| `SelectionCandidate` | a selection-pipeline candidate, optionally linked to a `Scholar` once admitted |
| `SelectionStageHistory` | audit trail of stage transitions for a `SelectionCandidate` |
| `RawJotformSubmission` | raw placeholder-ingestion payload (see ARCHITECTURE.md) |
| `DataQualityIssue` | a detected issue from `runDataQualityScan()` |
| `SyncLock` | DB-backed mutual-exclusion lock preventing concurrent import/sync runs |
| `ControlValue` | reference/control values, unique per `(category, value)` |
| `AppUser` | an application user — email-matched to a Supabase identity, carries `role` |
| `UserScholarAccess` | mentor → assigned-scholar grants (also used for future access types) |
| `DataImportBatch` | one row per import run — status, entities touched, parsed rows, error report, and (for rollback) which rows it inserted |

## Longitudinal Model

The database does **not** mirror the original wide spreadsheet (one row per scholar with a
column per term/month). Scholar data is normalized into time-specific records
(`AcademicTerm` per term, `MentorReport`/`MonthlyCheckin`/`RiskAssessment` per period) and
domain-specific records (support activity, requests, financial inputs), each keyed back to
`scholarId`. See `docs/adr/002-normalized-postgresql-model.md` and
`docs/reference-data-audit.md` for the source-sheet shape this replaces.

## Important Constraints

Real `@@unique`/`@@index` entries from the schema (not exhaustive field-level `@unique`s like
`AppUser.email` or `MonthlyCheckin.submissionId` — see the schema for those):

- `AcademicTerm` — `@@unique([scholarId, term])`
- `SupportActivity` — `@@unique([scholarId, period, activityType, source])`
- `RiskAssessment` — `@@unique([scholarId, period])` — one classification per scholar per period;
  this is why risk history cannot currently be rolled up by semester (the same program month in
  two semesters shares one key — see `docs/PRODUCT.md`'s Out of Scope section)
- `ControlValue` — `@@unique([category, value])`
- `UserScholarAccess` — `@@unique([userId, scholarId, accessType])`

Indexes exist on every foreign key used in dashboard filtering (`Scholar.country`,
`Scholar.cohort`, `Scholar.universityId`, `Scholar.operatorId`, `Scholar.programStatus`), on
every `importBatchId` (for batch-scoped queries and rollback), and on lookup-heavy columns like
`RiskAssessment.globalRiskLevel` and `RiskAssessment.period`.

## Import and Audit Fields

Most scholar-child models carry `importBatchId String?`, pointing at the `DataImportBatch` that
last wrote the row — used for audit and for insert-only rollback
(`src/lib/data-import/service.ts::rollbackImportBatch`, which deletes only rows recorded in that
batch's `insertedRefs`, never touches updates, and only once per batch).

**`RiskAssessment` has no `importBatchId`** — it is deliberately not rollback-tracked. Per the
commit-path comment: *"they're a mirror of the sheet, re-set on next sync."* Rolling back an
import that touched risk does not revert `RiskAssessment` rows; the next sync overwrites them
with current source values instead.

## Referential Behavior

Every scholar-child relation cascades on scholar deletion (`onDelete: Cascade`) — `AcademicTerm`,
`MonthlyCheckin`, `MentorReport`, `SupportActivity`, `ScholarRequest`, `RiskAssessment`,
`UserScholarAccess`. The one exception is `FinancialInput`, which uses `onDelete: SetNull`
(its `scholarId` is nullable — some cost rows are program-level, not scholar-level).
`SelectionStageHistory` cascades on its parent `SelectionCandidate`.

## Money

The only `Decimal` field in the schema is `FinancialInput.costAmount Decimal @db.Decimal(14, 2)`,
paired with a free-text `currency` field (`COP | PEN | USD` per source data).

## Raw Data

`RawJotformSubmission.payloadJson Json` stores the raw placeholder-ingestion payload verbatim.
`DataImportBatch` carries three `Json?` fields: `parsedRows` (validated canonical rows, consumed
at commit), `errorReport` (`[{ entity, rowNumber, field, message }]`), and `insertedRefs`
(`{ "<table>": ["id", ...] }`, the insert-only rollback index).

## Schema Change Policy

All schema changes go through Prisma migrations (`npm run db:migrate`, i.e. `prisma migrate
dev`). Historical migrations under `prisma/migrations/` are immutable — never hand-edit a past
migration or the database directly. See `docs/adr/005-prisma-migrations.md`.
