# SPEC-002 — Spreadsheet Ingestion Refactor

Status: Active

## Goal

Refactor ingestion so that the current operational `SCHOLAR GENERAL INFO` and `MENTOR REPORTS`
spreadsheets are translated through source-specific TypeScript adapters into canonical
application entities before validation and persistence, formalizing behavior that mostly already
exists (`legacy.ts`, `legacy-mentor-reports.ts`) behind an explicit adapter contract and adding
schema-drift detection, without changing dashboard behavior, risk semantics, or the canonical
scholar identifier.

## Product Principle

The application adapts to the operational spreadsheets. The program team is not required to adapt
its workflow, headers, or column order to the application's internal schema.

## Context

See `docs/adr/007-spreadsheet-source-adapters.md` for the architectural decision. In short: the
live automated sync (Apps Script `Normalize.gs` → `Sync.gs` → `TEMPLATE` adapter) and the manual
raw-tab upload path (`legacy.ts` family, `sourceType: "LEGACY_WIDE_EXCEL"`) currently reimplement
equivalent header-parsing and field-mapping logic in two different runtimes. This spec covers
formalizing the TypeScript side; it does not cover switching the live sync over to it (see
Deferred, below).

## Supported Sources

### Scholar General Info

Produces:
- `Scholar`
- `AcademicTerm` (zero or more per scholar row, pivoted from repeating per-term columns)

### Mentor Reports

Produces:
- `MentorReport`
- `RiskAssessment` (mapped from the report's `GLOBAL STATUS`, ingested verbatim — never derived;
  see ADR-006)

## Ingestion Paths

Automated Google Sheets Sync (unchanged in this spec):

```
Google Sheets
      |
Apps Script Normalize.gs (business mapping, unchanged this pass)
      |
Apps Script Sync.gs (transport)
      |
sync API (x-entity header)
      |
templateAdapter
      |
validation
      |
automatic commit (ingestAndCommit)
      |
data quality
```

Manual Import:

```
uploaded file (raw tab or single-entity template)
      |
source adapter (scholar-general-info / mentor-reports / template)
      |
canonical batch (+ schema drift report)
      |
validation
      |
preview (createImportBatch)
      |
human commit (commitImportBatch)
      |
data quality
```

Both paths already converge on the same `service.ts` orchestration
(`createImportBatch`/`commitImportBatch`); this spec adds a named `ingestAndCommit` composition
for the sync path and moves the underlying adapters/validation-context/reference-data behind
clearer boundaries, without changing that convergence.

## Non-goals

- JotForm integration.
- Spreadsheet redesign.
- Dashboard redesign or new metrics.
- Risk-formula redesign or re-enabling risk derivation.
- Financial ingestion or selection-pipeline ingestion changes.
- A generic ETL platform or dynamic adapter-plugin registration.
- New source systems.
- Changing the `RiskAssessment` unique key or resolving the `MONTHLY_STATUS` reachability gap
  (documented, not fixed — see ADR-007's Consequences).

## Acceptance Criteria

### Source handling

- Scholar General Info can be ingested from the current operational structure (multi-row header,
  decorative rows above it, bilingual headers, repeating per-term columns).
- Mentor Reports can be ingested from the current operational structure (dynamic header row below
  a decorative summary block, bilingual headers).
- Column position is not relied on where stable header matching is possible (both adapters are
  already header-keyed, not positional, except where a source's own duplicate-header shape makes
  positional resolution unavoidable — e.g. the historically-ambiguous repeated `ESTADO FINAL`
  columns, left unresolved rather than guessed).
- Reordered known columns remain ingestible.
- Blank optional columns do not fail the whole row.
- Known-ignored columns (documented in the source contract) produce no warning.
- Unknown new columns produce a drift warning (`SourceSchemaReport.unknown`), not a hard failure.
- Missing required columns produce an explicit `SOURCE`-stage error, not a guess.

### Scholar General Info

- One source scholar row creates/updates one `Scholar` and zero or more `AcademicTerm` records.
- Term-specific fields are associated with the correct semester via the term's own header suffix
  (`YYYY-N`), never guessed from row position.
- A blank future-semester block produces no `AcademicTerm` row (no fabricated data).

### Mentor Reports

- One source row creates/updates one `MentorReport` and, when `GLOBAL STATUS` is present and
  recognized, one `RiskAssessment` row.
- `GLOBAL STATUS` is never replaced by a newly derived calculation (see ADR-006). No import path
  calls `src/lib/risk/derive.ts` or `recompute.ts`.

### Validation

- Shared validation (`validate.ts`) runs after source adaptation and is unaware of source layout.
- Errors distinguish `SOURCE` (schema/column-level), `VALIDATION` (row-level), and `PERSISTENCE`
  (commit-time) stages.
- One invalid row does not reject the whole batch — existing partial-success behavior
  (`successRows`/`errorRows`) is preserved unchanged.

### Idempotency

- Reprocessing the same source snapshot does not create duplicate canonical records: `Scholar` by
  `scholarId`, `AcademicTerm` by `(scholarId, term)`, `MentorReport` by `submissionId`,
  `RiskAssessment` by `(scholarId, period)` — all pre-existing unique constraints, unchanged.

### Provenance

- Every committed record remains traceable to its `DataImportBatch` (source type, filename,
  uploader, timestamp) via the existing `importBatchId` mechanism. No schema migration is added
  for row-level source-cell provenance in this pass — the existing batch-level mechanism is
  sufficient for this phase's acceptance criteria.

### Google Sheets Sync

Unchanged in this spec: authentication (`x-api-key`), the DB-backed sync lock, the Preview-
environment mutation guard, `DataImportBatch` recording, and the post-commit data-quality scan
all continue exactly as today. The sync route is refactored to call one `ingestAndCommit` function
instead of manually chaining two calls — behavior-preserving.

### Manual Imports

Preview-then-commit (`createImportBatch` → `commitImportBatch`) remains available and unchanged
from the admin UI's perspective, with schema-drift information added to the preview response as an
additive field.

### Dashboard

No dashboard behavior changes are part of this spec.

## Deferred (explicitly out of scope for this change)

- Switching `apps-script/Sync.gs` to POST raw source tabs through these adapters, and retiring
  `Normalize.gs`'s business-mapping role. Requires proving output parity against the real sheet —
  a manually-verified, separate change (see ADR-007).
- Removing any now-duplicate Apps Script logic (only safe after the above).
- `RiskAssessment` period-key redesign and the `MONTHLY_STATUS` reachability gap — documented in
  ADR-007's Consequences, not resolved here.

## Testing

- Unit tests for the two new adapters against synthetic fixtures modeled on the real sheet shapes
  (`tests/fixtures/scholar-general-info.csv`, `tests/fixtures/mentor-reports.csv`): reordered
  columns, missing optional columns, unknown extra columns, known-ignored columns, Colombia/Peru
  GPA scales, blank future terms, multi-term scholars.
- Unit tests for the drift-classification function itself.
- Existing integration tests (`tests/integration/import-pipeline.test.ts`,
  `sync-endpoint.test.ts`, `sync-lock.test.ts`) continue to pass unmodified where they assert
  current behavior, extended only where this spec adds new observable behavior (schema reports,
  `stage`-tagged errors).

## Documentation Impact

`docs/adr/007-spreadsheet-source-adapters.md` (new), this spec, and corrections to
`docs/sync-contract.md` and `docs/reference-data-audit.md` (both predate ADR-006 and still
describe mentor-report risk fields as feeding a "derived risk engine").
