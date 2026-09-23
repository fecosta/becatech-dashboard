# SPEC-006 — Drop-out Reasons

**Status:** PLANNED / BLOCKED — SOURCE DATA REQUIRED  
**Methodology state:** NOT IMPLEMENTABLE UNTIL THE SOURCE CONTRACT IS SUPPLIED  
**Repository baseline:** `main @ 58575cf278898324a46c96d40d730301c05757ed`  
**Origin:** SPEC-004 §12 (Home — Section 2 · Reasons for Dropped Out), deferred out of SPEC-004
so its source-ready scope could be accepted independently.

**Relevant prior specs:**  
- SPEC-002 — Spreadsheet Ingestion Refactor
- SPEC-004 — Dashboard Data & Visualization Corrections

**Relevant ADRs:**  
- `docs/adr/007-spreadsheet-source-adapters.md`

---

# 1. Status

`PLANNED / BLOCKED — SOURCE DATA REQUIRED`

This specification carries a requirement that was requested, reviewed and deliberately **not**
implemented. It is blocked, not abandoned, and not silently dropped: no drop-out reason exists
anywhere in the current repository contract, and none may be invented to unblock it.

Nothing in this specification is implementation-authorized until §3 is satisfied.

---

# 2. Goal

Display source-backed reasons for scholars who dropped out, in Home — Section 2 (Drop Outs).

Today that section intentionally renders a pending state. It should instead report why scholars
left, aggregated over the current Drop Outs scope.

---

# 3. Source gate

Implementation may not begin until the following are obtained and recorded:

1. exact spreadsheet / file identity;
2. exact tab name;
3. header structure — both header rows where the sheet uses two;
4. the **verbatim semantic header** of the drop-out-reason field;
5. approximately 20 representative anonymized values;
6. confirmation that historical withdrawn scholars are populated, and over what period;
7. blank / null semantics — is a blank "no reason recorded", "still enrolled", or "not asked";
8. whether values are a controlled list or free text.

## 3.1 Column letters are not a source contract

The originally requested spreadsheet coordinate `BB` is **not an accepted source contract** and
must never appear in ingestion or presentation code.

Column letters shift whenever a column is inserted upstream, and the repository's ingestion
contract is header-based by design (ADR-007). The implementation must resolve the field by its
semantic header, exactly as every other ingested field does.

## 3.2 No fabrication

No drop-out reason may be fabricated, inferred, defaulted, or back-filled from any other field —
not from `programStatus`, risk history, GPA, check-in gaps, or mentor commentary. A scholar
without a source reason has no reason.

---

# 4. Context

`Scholar.programStatus` already records **that** a scholar withdrew. Nothing records **why**.

The Drop Outs block on Home already exists, already has its Cohort / Country / University filters,
and already scopes to withdrawn scholars — so this work is the ingestion and one aggregation, not
a new dashboard surface.

---

# 5. User workflow

A program lead opens Home, reads Section 2 · Drop Outs, and sees the reasons scholars left ranked
by count, under whichever Cohort / Country / University filters are already applied.

---

# 6. Intended behavior

Once the §3 gate is satisfied:

- ingest the semantic drop-out-reason field through the normal source adapter path;
- preserve the raw source meaning — do not translate, re-bucket, or editorialize source values
  without an explicit product decision;
- aggregate reasons across scholars in the Drop Outs scope;
- render reason counts;
- represent missing values as `Not reported`, visible rather than dropped from the denominator;
- preserve the existing Drop Outs Cohort / Country / University block filtering.

---

# 7. Non-goals

- Deriving a reason from any existing field.
- Changing what counts as a drop-out (`ProgramStatus.WITHDRAWN` semantics are unchanged).
- Changing canonical scholar identity.
- Changing risk or GPA semantics.
- Any Program Satisfaction work — see SPEC-007.

---

# 8. Data considerations

A new stored field is likely. Expected surface area, to be confirmed against the real header:

- `prisma/schema.prisma` — a nullable reason field on `Scholar` (or a dedicated row if the source
  turns out to be multi-valued or dated);
- a Prisma migration;
- `apps-script/Normalize.gs` — normalization mapping, plus its unmapped-field documentation;
- the source contract documentation;
- `src/lib/data-import/adapters/` — admin import adapter;
- `src/lib/data-import/validate.ts` — validation;
- `src/lib/dashboard/queries.ts` — aggregation;
- `src/lib/dashboard/types.ts` — dashboard type;
- Home UI;
- tests.

Review `bulkUpsert()`'s `ON CONFLICT` keys before changing any uniqueness constraint.

Free-text values would additionally require a product decision on grouping before any
presentation work.

---

# 9. Authorization / security

No change. The Drop Outs block inherits the existing dashboard authorization, and any scholar-level
query must continue to pass through `scholarAccessWhere()`.

A drop-out reason may be sensitive personal information. Confirm with the program owner whether it
is visible to mentors or restricted to program staff **before** rendering it, rather than
inheriting the block's current visibility by default.

---

# 10. Governance

This item requires a data review before implementation.

If the confirmed source materially changes ADR-007's ingestion contract — a second sheet, a
different tab shape, a multi-valued or dated field — update ADR-007 or add a bounded follow-up
decision record rather than silently changing the ingestion model.

---

# 11. Acceptance criteria

Deferred until the §3 gate is satisfied. At minimum, the eventual implementation must satisfy:

- the field is resolved by semantic header, never by column letter;
- no reason is fabricated, inferred, or defaulted;
- blanks render as `Not reported` and remain in the denominator;
- Cohort / Country / University filtering behaves as the rest of the Drop Outs block does;
- counts reconcile with the withdrawn scholars in scope.

---

# 12. Testing

Deferred. Expected: adapter/validation unit tests over the real header, and a DB-backed
integration test covering ingestion plus the Home aggregation.

---

# 13. Documentation impact

Deferred. Expected: `docs/DATA_MODEL.md`, `apps-script/README.md`, the source contract
documentation, and ADR-007 if the ingestion contract changes.

---

# 14. Blocking action

**Required from the program/data owner:** the eight items in §3.

Until they are supplied, this specification stays in `resources/specs/planned/`.
