# ADR-007 — Spreadsheet Source Adapters and Canonical Ingestion

Status: Proposed
Date: 2026-09-02

## Context

The program team maintains two operational Google Sheet tabs — `SCHOLAR GENERAL INFO` and
`MENTOR REPORTS` — as their day-to-day working documents, not as a database schema. They contain
multi-row (category + field) headers, repeated per-semester field blocks, bilingual (Spanish/
English) labels, decorative rows above the real header, optional and sometimes-blank columns, and
columns that accumulate over time as the program's own tracking needs evolve. The program team is
non-technical program staff; they cannot be asked to redesign these sheets, maintain a normalized
hidden tab by hand, or adopt an application-shaped import template as their working document.

Today, the translation from this raw shape into canonical entities happens in **two places that
can drift independently**:

1. `apps-script/Normalize.gs`, which runs inside the bound Google Sheet (no CI/CD — changes are
   pasted manually into the Apps Script editor) and produces hidden `NORMALIZED_*` tabs that
   `apps-script/Sync.gs` POSTs to `/api/sync/import` via the simple, canonical-header `TEMPLATE`
   adapter. This is the live, automated path.
2. `src/lib/data-import/adapters/legacy.ts`, `legacy-mentor-reports.ts`, and
   `legacy-support-activity.ts`, which already implement equivalent multi-row-header detection,
   bilingual alias matching, and per-term regex pivoting **in TypeScript**, for the manual
   raw-tab-upload path (`sourceType: "LEGACY_WIDE_EXCEL"`).

`legacy.ts` itself documents the risk this creates: its term-column regexes are "kept in sync with
`apps-script/Normalize.gs`'s `TERM_RE_`/`CREDITS_RE_`/... — two separate runtimes, no shared
source." Two independently-maintained implementations of the same business mapping is exactly the
drift risk this ADR addresses. Separately, there is today no formal contract for what a "source
adapter" is, and no TypeScript-side equivalent of Apps Script's `detectUnrecognizedColumns_` —
schema drift (a new or missing column) is only ever detected inside the Apps Script runtime, not
in the tested, code-reviewed TypeScript layer.

## Decision

Operational spreadsheets are treated as **external source contracts**. Source-specific adapters
translate their current shapes into canonical ingestion entities before shared validation and
persistence run. Concretely:

- Source-specific transformation logic lives primarily in **tested TypeScript adapters**
  (`src/lib/data-import/adapters/`), each implementing a small `SourceAdapter` contract
  (`source`, `canHandle`, `adapt`, optional `inspectSchema`), backed by an explicit source
  contract (`src/lib/data-import/source-contracts/`) naming that source's required fields,
  optional fields, recognized aliases, and known-ignored columns.
- The two first-class operational source adapters are **Scholar General Info** (→ `Scholar` +
  `AcademicTerm`) and **Mentor Reports** (→ `MentorReport` + `RiskAssessment`/monthly risk). Both
  already existed as `legacy.ts`/`legacy-mentor-reports.ts` logic; this decision formalizes them
  behind the adapter contract and adds explicit schema-drift reporting
  (`SourceSchemaReport { recognized, ignored, unknown, missingRequired }`), rather than rewriting
  their field mappings.
- Shared validation (`validate.ts`) and persistence (`commit.ts`, `bulk-upsert.ts`) operate only on
  canonical entities and do not depend on source spreadsheet layout, column order, or header
  language.
- Apps Script is intended to **progressively become a transport/orchestration mechanism** —
  detect changes, export raw source, POST, log, retry — rather than a business-transformation
  layer. This ADR establishes that target and the TypeScript foundation for it (adapters, source
  contracts, drift detection). **It does not, by itself, change what Apps Script sends.**
  `Normalize.gs` still owns the live sync's header parsing and enum mapping, and `Sync.gs` still
  POSTs pre-normalized `NORMALIZED_*` tabs through the `TEMPLATE` adapter, exactly as before.
  Switching the live sync to POST raw tabs through these TypeScript adapters (retiring
  `Normalize.gs`'s business-mapping role) is a separate, follow-up change that requires proving
  output parity against the real sheet first — see Consequences.

## Consequences

Positive:

- Business mappings for the two operational sources become testable in the same runtime and test
  suite as the rest of the application, not only verifiable by manually pasting into the Apps
  Script editor and eyeballing a hidden tab.
- Source drift (a new column, a removed required column) becomes something the TypeScript layer
  itself can detect and report, not something that only surfaces as a silent Apps Script `WARN`
  log entry or a downstream data-quality symptom.
- Manual imports and the automated sync already share the same validation/persistence pipeline
  (`createImportBatch`/`commitImportBatch` in `service.ts`); this decision makes that convergence
  explicit at the adapter layer too, and gives it a named contract instead of an implicit one.
- The program team's sheets are unaffected — no new tabs, no renamed headers, no reordering
  requirement.

Trade-offs / known, deliberately-unresolved gaps:

- **Apps Script still duplicates business-mapping logic during this transition** (header parsing,
  bilingual aliases, enum mapping in `Normalize.gs`). This is intentional, not an oversight — see
  the recommended transition sequence in `specs/active/002-spreadsheet-ingestion-refactor.md`:
  prove TypeScript-adapter parity against real-shaped fixtures first, then cut the live sync over,
  then remove the duplicate Apps Script logic. None of those later steps are done by this ADR.
- **`RiskAssessment`'s identity is unchanged and known-imperfect.** Its unique key is
  `[scholarId, period]` with no semester/year component — a program month like `"MES 1"` from one
  semester collides with the same label from a different semester, silently overwriting the older
  row on upsert (already documented in `docs/prototype-comparison.md` and `docs/PRODUCT.md`'s
  out-of-scope list). This ADR does not change that key. Fixing it is out of scope here and would
  need its own ADR and migration plan (see ADR-006, which this ADR does not supersede).
- **The `MONTHLY_STATUS` → `RiskAssessment` ("sheet"-sourced) path described in ADR-006 is
  currently unreachable in practice.** No adapter produces `MONTHLY_STATUS` rows today (the
  Support Activity Log adapter only imports its activity-count sub-block, never its diagnostic/
  risk sub-block), the Apps Script sync never sends `x-entity: MONTHLY_STATUS`, and the admin
  import UI's entity list omits it. In practice, the Mentor Reports adapter's pass-through of
  `GLOBAL STATUS` is the only live risk-ingestion path in production, despite `prisma/schema.prisma`
  describing both paths as coexisting per ADR-006. This ADR does not wire up, remove, or otherwise
  resolve that gap — it is flagged here for a future, deliberate decision, not fixed incidentally.
- Adapters must keep explicitly handling source irregularities (decorative rows, ambiguous
  duplicate headers like a repeated bare `ESTADO FINAL`) rather than guessing; some of these
  remain intentionally unmapped (documented in the adapter code and `apps-script/README.md`'s
  unmapped-columns tables), not silently dropped.
- Raw source provenance (batch, source type, filename) is preserved via the existing
  `DataImportBatch`/`importBatchId` mechanism; no new audit schema or migration is introduced.

## Non-Goals

- Redesigning `SCHOLAR GENERAL INFO` or `MENTOR REPORTS`, or requiring the program team to rename,
  reorder, or restructure any column.
- Building a generic ETL framework or a dynamic plugin/adapter-registration system. Exactly two
  first-class operational adapters are in scope.
- Changing the canonical scholar identifier (`Scholar.scholarId` / `ID_becario` — see ADR-001).
- Changing dashboard metrics, risk semantics, or re-enabling risk derivation (see ADR-006).
- Changing the `RiskAssessment` unique-key/period identity, or resolving the `MONTHLY_STATUS`
  reachability gap noted above — both require their own future decision.
- Modifying `apps-script/Normalize.gs` or `apps-script/Sync.gs` in this change.

## Alternatives Considered

Continuing to maintain the mapping logic independently in `Normalize.gs` (Apps Script) and the
`legacy*.ts` adapters (TypeScript) was considered — it is, in effect, the status quo. It was
rejected because it is the drift risk this ADR exists to close: the two runtimes already required
a manual "keep in sync" comment (`legacy.ts`'s term-regex comment) rather than a single tested
source of truth, and neither runtime has ever cross-validated its output against the other's.
