# TASK-001 — Validate Spreadsheet Ingestion Parity

Status: Active
Owner: Engineering
Related spec: SPEC-002 — Spreadsheet Ingestion Refactor
Related ADRs: ADR-006, ADR-007, ADR-008
Created: 2026-09-09
Completed: —

## Objective

Validate the spreadsheet ingestion refactor against representative Beca Tech operational data, fix demonstrated adapter gaps, verify Apps Script ↔ TypeScript parity, correct stale ingestion documentation, and determine whether SPEC-002 can be closed.

This task is validation and completion work under the existing SPEC-002. It must not change the live Google Sheets sync architecture.

---

# Implementation Prompt

## Task: Validate and close the Beca Tech Spreadsheet Ingestion Refactor

Repository: `fecosta/becatech-dashboard`

Start from the latest merged `main`.

The purpose of this task is to complete the current spreadsheet-ingestion refactor by validating the TypeScript source adapters against representative Beca Tech operational spreadsheet structures, fixing only genuine ingestion gaps discovered during that validation, correcting stale documentation, and producing clear evidence that the refactored ingestion behavior is trustworthy.

Do **not** change the live Google Sheets Apps Script mapping/sync architecture in this task.

---

## 1. Read first

Before changing code, inspect the current repository state and read:

- `AGENTS.md`
- `README.md`
- `docs/ARCHITECTURE.md`
- `docs/DATA_MODEL.md`
- `docs/SECURITY.md`
- `docs/DEVELOPMENT.md`
- `docs/adr/006-*`
- `docs/adr/007-spreadsheet-source-adapters.md`
- `docs/adr/008-risk-period-identity.md`
- `docs/sync-contract.md`
- `docs/reference-data-audit.md`
- the current owning spreadsheet-ingestion spec
- `prisma/schema.prisma`

Also inspect the current ingestion implementation, especially:

- source adapters
- legacy spreadsheet adapters/parsers
- canonical ingestion types
- validation
- persistence/commit pipeline
- `createImportBatch`
- `commitImportBatch`
- `ingestAndCommit`
- mentor-report-to-risk mapping
- schema drift handling
- Apps Script sync route integration
- ingestion tests and fixtures

Search the repository rather than assuming filenames if implementation files have moved.

### Spec-location note

If the repository still has an inconsistency between the current spec location and the newer `resources/specs/` governance convention, do **not** perform a repository-wide spec/resource-directory migration as part of this task.

Use the currently authoritative SPEC-002 location established by `AGENTS.md` and current repository state.

Report any remaining structure inconsistency as a separate governance follow-up.

---

## 2. Current situation

The dashboard and several downstream pieces have advanced beyond the original state in which SPEC-002 was written.

Recent merged work includes:

- spreadsheet ingestion adapters and dashboard refresh;
- semester-aware `RiskAssessment` identity;
- M1 → M6 participation/risk trend support;
- dashboard UX hierarchy cleanup.

The remaining active implementation work is the spreadsheet-ingestion refactor.

SPEC-002 already defines the desired architecture:

```text
operational spreadsheet
        |
source-specific adapter
        |
canonical entities
        |
shared validation
        |
persistence
        |
data quality
```

The core operational sources are:

1. `SCHOLAR GENERAL INFO`
2. `MENTOR REPORTS`

The application must adapt to the program team's spreadsheets.

The spreadsheets must **not** be redesigned merely to simplify application ingestion.

---

## 3. Goal

Complete and validate SPEC-002 so that we have strong evidence that representative operational Beca Tech spreadsheet structures are correctly translated into canonical application entities.

The final state should demonstrate that:

### Scholar General Info

A valid operational scholar row can correctly produce:

- `Scholar`
- zero or more `AcademicTerm` records

Term-specific data must remain associated with the correct semester.

Blank future-semester sections must not fabricate academic records.

### Mentor Reports

A valid operational mentor-report row can correctly produce:

- `MentorReport`
- `RiskAssessment`, when an authoritative recognized `GLOBAL STATUS` is present

`GLOBAL STATUS` remains authoritative program data.

It must never be silently replaced by a derived risk calculation.

### Shared behavior

The ingestion pipeline should correctly handle:

- decorative rows before the real header;
- multi-row headers where applicable;
- bilingual headers;
- repeating semester fields;
- dynamic header positions;
- reordered known columns;
- blank optional fields;
- known ignored fields;
- genuinely unknown columns;
- missing required columns;
- partial-success batches;
- schema-drift reporting;
- idempotent re-imports.

---

## 4. Non-goals

Do not implement any of the following:

- JotForm integration.
- Spreadsheet redesign.
- New dashboard features.
- Dashboard visual redesign.
- New dashboard metrics.
- New risk formula.
- Risk derivation from intervention/activity fields.
- Generic ETL framework.
- Dynamic adapter-plugin architecture.
- New source systems.
- Financial ingestion changes.
- Selection-pipeline ingestion changes.
- Authentication changes.
- Authorization changes.
- Live Google Sheets architecture replacement.
- Retirement of `Normalize.gs`.
- Large Apps Script cleanup.
- Repository-wide folder restructuring.
- Unrelated refactors.

Do not change application behavior simply because an older document disagrees with current code.

Where documentation and implemented reality conflict, identify the conflict and determine which accepted ADR/current schema owns the behavior.

---

## 5. First deliverable: implementation audit

Before making significant changes, produce an audit of the existing ingestion system.

Document:

### A. Source entry points

Identify every current entry point for spreadsheet data, including:

- manual uploads;
- sync API;
- Apps Script;
- template ingestion;
- legacy/raw spreadsheet ingestion.

### B. Adapter paths

For each entry point, identify which adapter/parser is called.

Show the flow as a small map:

```text
source
→ parser
→ adapter
→ canonical batch
→ validation
→ preview/commit
→ persistence
```

### C. Entity writers

Identify all code paths currently writing:

- `Scholar`
- `AcademicTerm`
- `MentorReport`
- `RiskAssessment`
- `DataImportBatch`

### D. Risk handling

Verify explicitly:

- where `GLOBAL STATUS` enters the system;
- whether any active ingestion path calls risk derivation code;
- whether `src/lib/risk/derive.ts` or equivalent is reachable from ingestion;
- whether `recompute.ts` or equivalent is reachable from ingestion.

No active ingestion path should silently derive program risk.

### E. Risk identity

Inspect:

- `prisma/schema.prisma`
- ADR-008
- persistence conflict/upsert keys
- ingestion deduplication
- relevant tests

Confirm the actual current unique identity for `RiskAssessment`.

Expected current architecture after ADR-008:

```text
scholarId + semester + period
```

Do not assume the old SPEC-002 statement is still correct.

### F. Test coverage

List what is already covered and identify meaningful ingestion behaviors that are still unverified.

Only after this audit should implementation changes begin.

---

## 6. Representative spreadsheet validation

Use representative source data already available in the repository.

Inspect any relevant samples or fixtures currently available.

If representative operational samples are available in a project resource/sample directory, use them as **source-shape evidence**, not production truth.

Never commit real scholar PII into tests.

If source samples contain real people:

- do not duplicate their data into fixtures;
- create anonymized or fictional test fixtures preserving only the structural characteristics needed for tests.

Do not fabricate spreadsheet semantics merely because a sample is incomplete.

---

## 7. Scholar General Info validation

Validate the adapter against realistic source structure.

At minimum verify:

### Header discovery

The adapter can locate the actual header when:

- decorative/title rows appear above it;
- multiple header rows exist;
- columns are reordered.

### Header matching

Verify supported bilingual or historical variants based on actual adapter/source evidence.

Do not invent aliases unnecessarily.

### Scholar identity

Preserve the canonical scholar identifier currently established by the application.

Do not create a new identity scheme.

### Academic terms

Verify repeating semester groups such as:

```text
2025-2
2026-1
2026-2
```

or equivalent structures actually supported by the operational source.

Each populated semester block must map to the correct `AcademicTerm`.

Never infer the semester from column position when the source header provides the semester explicitly.

### Empty future terms

A completely blank future semester block must produce:

```text
no AcademicTerm
```

rather than a mostly-empty fabricated row.

### Country-specific academic values

Where Colombia and Peru use different academic conventions or GPA scales, preserve existing application semantics.

Do not normalize values into a new invented universal scale unless the current accepted architecture already defines one.

---

## 8. Mentor Reports validation

Validate the Mentor Reports adapter against realistic source structure.

Verify:

### Header discovery

The adapter can locate the report header below decorative or summary sections.

### Mentor-report identity

Preserve the existing canonical report identity and idempotency behavior.

### Semester and program month

Verify both are mapped correctly where available.

Program month labels such as:

```text
M1
M2
M3
...
```

or equivalent source labels must never be treated as globally unique across semesters.

### GLOBAL STATUS

`GLOBAL STATUS` is authoritative program data.

When present and recognized:

```text
MentorReport
+
RiskAssessment
```

should be produced according to current domain rules.

When missing or unrecognized:

- do not invent a risk level;
- preserve existing validation/data-quality behavior;
- make the behavior explicit in tests.

Do not use intervention/activity columns to recalculate `GLOBAL STATUS`.

---

## 9. Schema drift

Review the existing `SourceSchemaReport` or equivalent implementation.

Verify:

### Known columns

No drift warning.

### Known ignored columns

No drift warning.

### Unknown new columns

Produce a schema-drift warning.

Do not reject the complete source solely because a harmless new column appeared.

### Missing required columns

Produce an explicit source/schema-stage error.

Do not silently guess the missing field.

Preserve the existing distinction between errors such as:

```text
SOURCE
VALIDATION
PERSISTENCE
```

if that is the current implemented contract.

---

## 10. Partial success

Preserve batch-level partial success.

One invalid row must not automatically reject valid rows in the same batch unless an existing architectural invariant requires atomic behavior.

Verify behavior around concepts equivalent to:

```text
successRows
errorRows
```

with regression tests.

---

## 11. Idempotency

Validate re-import behavior.

At minimum verify current persistence identity for:

```text
Scholar
AcademicTerm
MentorReport
RiskAssessment
```

Do not use the stale SPEC-002 risk key if ADR-008/current Prisma schema supersedes it.

Explicitly test that processing the same logical source snapshot twice does not create duplicate canonical records.

Also verify cross-semester risk history does not overwrite the same program month from another semester.

---

## 12. Fix only demonstrated gaps

After completing the audit and representative validation, fix ingestion code only when a concrete failing case demonstrates a real gap.

Prefer small changes at the source-adapter boundary.

Do not rewrite working ingestion architecture simply for stylistic consistency.

Do not create abstractions unless they eliminate genuine duplicated domain behavior without obscuring the source-specific contracts.

Keep:

```text
messy source parsing
```

at the source boundary and:

```text
canonical validation/persistence
```

source-independent.

---

## 13. Live Google Sheets sync — preserve behavior

Do not switch the live sync architecture in this task.

The current production path involving Apps Script must remain behaviorally unchanged.

In particular, do not yet:

- POST raw operational tabs instead of normalized data;
- retire `Normalize.gs`;
- remove mapping logic from Apps Script;
- redesign `Sync.gs`;
- change sync authentication;
- change sync locking;
- change Preview-environment mutation protections;
- change sync persistence semantics.

You may inspect this flow and document duplication/parity requirements.

Do not replace it.

---

## 14. Parity assessment

Produce a concrete parity assessment between:

### Existing live normalization path

```text
Google Sheets
→ Normalize.gs
→ Sync.gs
→ API/template adapter
→ canonical data
```

and:

### Target TypeScript raw-source adapter path

```text
raw operational spreadsheet
→ source adapter
→ canonical data
```

The purpose is to determine whether a subsequent PR could safely simplify Apps Script.

Compare at least:

- scholar identity;
- profile fields;
- academic-term identity;
- semester mapping;
- mentor-report identity;
- mentor-report fields;
- risk/status;
- semester;
- reporting/program month;
- null handling;
- ignored columns;
- validation behavior.

Do not claim full parity unless you actually have sufficient evidence.

Classify findings as:

```text
PARITY CONFIRMED
PARITY DIFFERENCE
NOT ENOUGH EVIDENCE
```

A lack of sufficient real-source evidence is an acceptable result and should be reported rather than guessed around.

---

## 15. Correct stale SPEC-002 documentation

SPEC-002 currently contains at least one known stale statement.

It describes `RiskAssessment` idempotency as:

```text
(scholarId, period)
```

Current ADR-008/current schema should be verified.

If current implementation confirms the semester-aware identity, update SPEC-002 to:

```text
(scholarId, semester, period)
```

Also review SPEC-002 for other statements made stale by already-merged work.

Only correct statements where current repository evidence is clear.

Do not expand this into broad documentation rewriting.

---

## 16. SPEC lifecycle

If every acceptance criterion in SPEC-002 is demonstrably satisfied after this work:

- update the spec's status appropriately;
- move it to the repository's existing completed-spec convention only if that is consistent with current repository governance.

If acceptance criteria remain unresolved:

- keep the spec active;
- explicitly list remaining blockers.

Do not declare the spec complete merely because tests pass.

Completion requires the implementation evidence requested by this task.

---

## 17. Tests

Add or strengthen focused regression tests where necessary.

Coverage should include, where applicable:

### Scholar General Info

- decorative rows before header;
- multi-row header parsing;
- reordered columns;
- unknown added column;
- known ignored column;
- missing required column;
- blank optional fields;
- repeated semester blocks;
- multiple academic terms for one scholar;
- blank future semester;
- Colombian academic-value examples;
- Peruvian academic-value examples;
- idempotent re-import.

### Mentor Reports

- decorative rows before header;
- reordered columns;
- missing optional field;
- unknown added column;
- missing required field;
- recognized `GLOBAL STATUS`;
- missing `GLOBAL STATUS`;
- unrecognized status;
- semester mapping;
- program-month mapping;
- same M-number in different semesters;
- idempotent re-import.

### Pipeline

- partial success;
- SOURCE vs VALIDATION vs PERSISTENCE errors;
- schema drift in preview;
- manual preview → commit;
- automated `ingestAndCommit`;
- no active ingestion dependency on risk derivation.

Do not add tests merely to increase test count.

Each test should protect an explicit product/data invariant.

---

## 18. No production PII

Do not commit real personally identifiable scholar information into:

- fixtures;
- snapshots;
- source files;
- debug output;
- documentation;
- test failure messages.

If real sample spreadsheets exist locally, treat them as inspection inputs only unless repository policy explicitly permits sanitized copies.

Use fictional/anonymized values for committed fixtures.

Preserve header names and structural characteristics where needed for adapter validation.

---

## 19. Data model

A Prisma migration is **not expected** for this task.

Do not change the schema unless the audit reveals a genuine blocker that makes SPEC-002 impossible to satisfy.

If you believe a schema change is necessary:

STOP that portion of implementation.

Document:

- why it is necessary;
- what invariant cannot currently be represented;
- migration implications;
- backfill implications;
- risk to existing imports.

Do not hide a database migration inside this ingestion-validation task.

---

## 20. Security

This task should not change authorization behavior.

Do not modify:

- scholar visibility;
- user roles;
- mentor scoping;
- sensitive contact visibility;
- auth middleware;
- permission checks.

If ingestion exposes a security problem involving sensitive fields, report it separately rather than broadening this PR without an explicit requirement.

---

## 21. Validation commands

Inspect `package.json` and repository documentation and run the exact appropriate project commands.

At minimum, when available, run:

```bash
npm test
npm run lint
npm run typecheck
npm run build
```

Use the repository's actual scripts if these names differ.

Also run focused ingestion tests separately so failures are easy to diagnose.

If Prisma was not modified, do not manufacture migration-validation claims.

Report exact commands and their actual results.

Never claim:

- browser QA you did not perform;
- production spreadsheet validation you did not perform;
- Apps Script runtime testing you did not perform;
- integration tests you did not run.

---

## 22. Self-review

After implementation and tests, review the complete diff as if you were a senior engineer reviewing someone else's PR.

Explicitly answer:

1. Did this change accidentally modify dashboard behavior?
2. Did it change canonical scholar identity?
3. Did it derive risk anywhere instead of ingesting authoritative `GLOBAL STATUS`?
4. Can the same M-number from two semesters collide?
5. Can blank future academic terms create fabricated records?
6. Are any mappings positional where stable header-based mapping is available?
7. Does an unknown column incorrectly reject a whole import?
8. Does a missing required column get guessed instead of rejected explicitly?
9. Can one invalid row reject unrelated valid rows?
10. Does re-import create duplicate canonical records?
11. Did any real PII enter committed test fixtures?
12. Was live Apps Script behavior changed accidentally?
13. Did unrelated refactoring enter the diff?
14. Is the SPEC status supported by evidence?
15. Are there still parity questions that need real operational data to resolve?

Fix issues found by this self-review when they are within scope.

---

## 23. Final report

Return a structured report with:

### Audit findings

- current ingestion entry points;
- current adapters;
- persistence writers;
- risk path;
- RiskAssessment identity;
- important discrepancies found.

### Validation performed

For each source:

```text
SCHOLAR GENERAL INFO
MENTOR REPORTS
```

state which representative structures and edge cases were validated.

### Implementation changes

List each changed file and why it changed.

### Bugs/gaps fixed

For each:

```text
problem
root cause
fix
regression test
```

### Parity report

For each important mapping, classify:

```text
PARITY CONFIRMED
PARITY DIFFERENCE
NOT ENOUGH EVIDENCE
```

between the live Apps Script normalized path and TypeScript raw-source adapter path.

### Behavior explicitly preserved

Confirm:

- canonical scholar identity unchanged;
- authoritative risk semantics unchanged;
- live Apps Script flow unchanged;
- dashboard behavior unchanged;
- authorization unchanged.

### SPEC-002 status

State either:

```text
READY TO CLOSE
```

or:

```text
REMAINS ACTIVE
```

and explain why.

### Deferred follow-ups

Keep separate from this implementation.

At minimum consider whether these remain:

- raw-tab live sync through TypeScript adapters;
- retirement/reduction of `Normalize.gs`;
- Apps Script mapping cleanup;
- repository spec/resource directory normalization;
- unresolved ingestion-contract gaps discovered during parity validation.

### Validation results

Report exact results for:

```text
focused tests
full test suite
lint
typecheck
build
```

and any checks that could not be performed.

---

## Completion principle

The purpose of this task is not to redesign ingestion.

The purpose is to make the existing refactor **provably trustworthy** against Beca Tech's operational spreadsheet reality.

Prefer:

```text
inspect
→ compare
→ reproduce
→ test
→ make the smallest necessary fix
→ validate
→ document evidence
```

over:

```text
rewrite
→ abstract
→ hope
```

If representative source evidence is insufficient to prove a mapping, report the uncertainty explicitly rather than inventing behavior.
