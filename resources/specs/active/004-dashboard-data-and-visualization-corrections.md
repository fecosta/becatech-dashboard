# SPEC-004 — Dashboard Data & Visualization Corrections

**Status:** ACTIVE — BLOCKED ON PRODUCTION ACTION  
**Methodology state:** PHASES 1–3 IMPLEMENTED · PHASE 3 PENDING PRODUCTION RECOVERY · PHASES 4–5 DEFERRED TO SPEC-006 / SPEC-007  
**Repository baseline:** `main @ 9ed23e9ea16fde3f9c20dc70c6291d14295e02cb`  
**Closure audit re-verified at:** `main @ 58575cf278898324a46c96d40d730301c05757ed` (2026-09-23, see §25)  
**Depends on:** Completed dashboard foundation, spreadsheet ingestion, and UX/UI work  
**Relevant prior specs:**
- SPEC-001 — Scholar Profile Split
- SPEC-002 — Spreadsheet Ingestion Refactor
- SPEC-003 — Dashboard UX/UI Refresh

---

## 1. Purpose

Correct a bounded set of data, metric, and visualization issues across the Beca Tech dashboard while preserving the existing dashboard architecture, data authority, filter semantics, authorization model, canonical scholar identity, and program risk model.

This specification covers eight requested adjustments across:

- Home;
- Early Support — Academic & Psychosocial;
- Program Ecosystem — Universities & Operating Partners.

Six adjustments have sufficient repository evidence and product decisions to proceed.

Two adjustments remain blocked on missing source data:

- Drop-out reasons;
- Program Satisfaction.

Those blocked items remain part of this specification so they are not lost, but they must not delay implementation of the independent ready items.

---

# 2. Current State

The dashboard currently uses two ingestion paths:

1. Google Sheets production synchronization through Apps Script;
2. Admin CSV/XLSX import through source adapters.

Production primarily uses the Google Sheets → Apps Script → normalized tabs → sync API path.

The dashboard query layer reads normalized relational data from Postgres through Prisma and performs dashboard aggregation server-side.

Existing architecture includes:

- canonical scholar identity;
- country-aware GPA handling;
- normalized operator entities;
- current semester and program-stage logic;
- scoped dashboard filters;
- server-side authorization;
- source-value normalization;
- risk and academic domain helpers.

Business and aggregation logic must remain outside React presentation components.

---

# 3. Goals

This specification must deliver the following product outcomes.

## Home

1. Remove the unused `OVERALL · TARGET | PENDING` retention row.
2. Display Vulnerability Level using the existing source-backed socioeconomic values.
3. Prepare Drop-out Reasons for integration once its authoritative source field is confirmed.
4. Prepare Program Satisfaction for integration once its separate source spreadsheet is provided.

## Early Support — Academic & Psychosocial

5. Show the number of scholars in Year 1 and Year 2.
6. Change the Participation and Risk Level monthly trend from lines to vertical bars.
7. Correct the GPA distribution so it uses production-backed GPA data and a correct denominator.

## Program Ecosystem

8. Simplify Operating Partners to the four operator names and the number of scholars supported by each.

---

# 4. Non-goals

This specification does **not** authorize:

- redesigning the overall dashboard;
- restructuring program-team spreadsheets;
- changing canonical scholar identity;
- changing authentication or authorization;
- re-deriving the authoritative risk classification;
- changing the global risk model;
- changing current block-filter scope except where explicitly required by a newly integrated source;
- converting Colombia and Peru GPA scales into one another;
- introducing a new academic grading scale;
- inferring operating partners from university, country, cohort, or program stage;
- redesigning the program-stage model;
- changing the AUGUST 4 dashboard structure beyond the specified corrections;
- implementing fake or placeholder satisfaction data;
- hard-coding a drop-out reason field without source verification.

---

# 5. Product and Technical Decisions

The following decisions are authoritative for implementation of this specification.

---

## D1 — GPA authoritative field

**Decision:** Early Support GPA Distribution must use `AcademicTerm.gpa`.

It must not use `AcademicTerm.accumulatedGpa` as its authoritative production source.

### Rationale

The production Google Sheets sync writes per-term `gpa` but does not populate `accumulatedGpa`.

Other dashboard GPA logic already correctly uses `AcademicTerm.gpa`.

The GPA distribution must therefore use the same production-backed data source.

### Required selection rule

For each scholar:

- consider GPA on the scholar's native country scale;
- select the latest term with a valid, non-zero GPA;
- ignore future/ungraded rows;
- ignore null GPA;
- ignore non-finite GPA;
- ignore negative GPA;
- ignore values above the valid country scale;
- treat exact GPA `0` as not enrolled / not graded, not as a failing grade.

The existing valid-latest-term behavior used by other GPA dashboard logic should be extracted or reused as a shared domain helper rather than reimplemented independently.

### Explicitly rejected

Do not map the scholar-level `Cumulative GPA` field into production as part of this specification.

Doing so would reverse an existing ingestion decision and require separate architecture governance.

---

## D2 — GPA country semantics

Colombia and Peru retain their native GPA scales:

- Colombia: 0–5
- Peru: 0–20

They must not be blended into a raw GPA mean.

The existing Colombia-specific GPA distribution buckets remain:

- `< 3.5`
- `3.5 – < 4.0`
- `4.0 – 5.0`

These boundaries are not being changed.

Peru scholars must not be incorrectly placed into Colombia's distribution buckets.

The UI must make excluded/not-applicable scholars visible rather than silently removing them from the denominator.

---

## D3 — Operating Partner presentation

The Operating Partners section must present a stable list of the four canonical operating partners:

- Fundación Antivirus para la Deserción
- ESCALO
- MAKERS
- Confident English

Each row must show:

`Operator Name — N scholars`

The four rows remain visible even when filters produce a count of `0`.

### Source of truth

Scholar-to-operator assignment remains:

`Scholar.operatorId → Operator`

The dashboard must not infer operator assignment from:

- country;
- cohort;
- university;
- program stage.

Existing seed/default assignment helpers are not authoritative for real production scholar data.

### Production verification gate

Before final implementation acceptance, production must be checked to confirm the Operator catalog contains the expected four canonical entities.

If production contains a conflicting operator catalog, implementation must stop with:

`BLOCKED / DECISION REQUIRED`

and must not hard-code around the conflict.

---

## D4 — Vulnerability terminology

The dashboard must use the source semantics directly rather than the currently unapproved Tier wording.

Use:

- High vulnerability
- Moderate vulnerability
- Low vulnerability

These correspond to:

- `Vulnerabilidad alta`
- `Vulnerabilidad moderada`
- `Vulnerabilidad baja`

The dashboard must not use:

- `Tier 1 · High vulnerability`
- `Tier 2 · Moderate poverty`
- `Tier 3 · Vulnerable`

because those labels alter or weaken the meaning of the source values.

Pending and unrecognized values must remain visible as unclassified/not reported rather than being silently dropped.

The existing ingestion source and classification mapping remain authoritative.

---

## D5 — Operating Partners and active filters

Existing page-level filters continue to affect scholar counts.

The operator row list itself remains stable at four rows.

Example:

If a Country=Peru filter results in:

- ESCALO — 20
- MAKERS — 8
- Fundación Antivirus para la Deserción — 0
- Confident English — 0

all four rows remain visible.

This preserves the user's intended view of the four program operators while keeping counts scoped to the current filters.

---

## D6 — Drop-out reasons source

The requested source coordinate `BB` is **not sufficient evidence** to implement the feature.

Repository evidence shows the last-verified live layout resolves that coordinate to another field.

Therefore the implementation must use the actual semantic source header once confirmed, not the spreadsheet letter itself.

Drop-out Reasons remains blocked until the source data gate in Section 12 is satisfied.

---

## D7 — Program Satisfaction source

Program Satisfaction is sourced from a separate spreadsheet that is not currently represented in the repository.

No satisfaction value may be fabricated, proxied from check-ins, or inferred from another survey.

Integration remains blocked until the data-source contract in Section 13 is satisfied.

---

# 6. Home — Section 3 · Program Retention

## 6.1 Current state

The table includes a hard-coded:

`OVERALL · TARGET | PENDING`

row.

It does not participate in:

- retention calculations;
- totals;
- filters;
- exports;
- data queries.

No approved program target currently backs this row.

---

## 6.2 Required behavior

Remove the `OVERALL · TARGET | PENDING` row.

The retention table must continue displaying actual retention results.

No retention formula, denominator, source, or filter behavior may change.

---

## 6.3 Acceptance criteria

- `OVERALL · TARGET` is no longer rendered.
- `OVERALL · ACTUAL` remains.
- Country-level retention rows remain unchanged.
- Existing Cohort, Country, and University filters remain unchanged.
- Existing retention percentages are identical before and after this change.
- No data-layer change is introduced.

---

## 6.4 Risk

**Low**

---

# 7. Home — Section 4 · Vulnerability Level

## 7.1 Current state

The source data is already ingested from the live spreadsheet socioeconomic field corresponding to the requested source.

The existing domain parser recognizes:

- `Vulnerabilidad alta`
- `Vulnerabilidad moderada`
- `Vulnerabilidad baja`
- Pending values
- Unrecognized values

The dashboard currently suppresses the distribution because the previous display labels were not approved.

---

## 7.2 Required behavior

Display Vulnerability Level using direct source semantics:

| Source value | Dashboard label |
|---|---|
| Vulnerabilidad alta | High vulnerability |
| Vulnerabilidad moderada | Moderate vulnerability |
| Vulnerabilidad baja | Low vulnerability |

Additionally surface:

- Pending / Not reported
- Unrecognized, when present

Do not silently exclude them.

---

## 7.3 Percentage denominator

Percentages for High / Moderate / Low vulnerability must be computed over **classified scholars only**.

The UI must separately expose the number of scholars that are:

- pending/not reported;
- unrecognized.

The implementation must not make the classified percentages appear to represent all scholars when unclassified scholars exist.

---

## 7.4 Filters

Continue using the current Home scope:

- Cohort
- Country
- University
- existing global filters where applicable.

No new block-filter scope is introduced.

---

## 7.5 Acceptance criteria

- High, Moderate, and Low vulnerability counts are visible.
- Labels preserve source meaning.
- No unapproved Tier wording remains.
- Pending values are not assigned to a vulnerability category.
- Unrecognized values are not assigned to a vulnerability category.
- Classified percentages use the classified denominator.
- Unclassified count is visible.
- Existing filters continue to apply.
- No schema or ingestion change is required.

---

## 7.6 Risk

**Low**

---

# 8. Early Support — Section 1 · Scholars in Years 1 and 2

## 8.1 Current state

The domain layer already computes:

- Year 1 scholars
- Year 2 scholars

using the existing canonical program-year logic.

The Early Support page already fetches the relevant overview data but does not render these counts.

---

## 8.2 Required behavior

Display:

- Year 1 — N scholars
- Year 2 — N scholars

within Section 1.

The implementation may use the existing fact strip or another existing dashboard primitive that preserves the section hierarchy.

Do not introduce a new program-year calculation.

---

## 8.3 Classification rules

Year classification remains derived from `currentSemester`.

### Year 1

Semester:

`<= 2`

within the valid Years 1–2 scope.

### Year 2

Semester:

`> 2 and <= 4`

### Unknown/null semester

Must not be silently classified into Year 1 or Year 2.

The existing program-stage scope already excludes null semesters from Years 1–2.

---

## 8.4 Required invariant

For the Early Support population:

`Year 1 + Year 2 = active scholars in Years 1–2`

provided all scholars in the scope have a valid supported semester.

Tests must make any exception explicit rather than silently weakening the invariant.

---

## 8.5 Filters

The counts inherit the existing Early Support page scope and filters.

No new filter is introduced.

---

## 8.6 Acceptance criteria

- Year 1 count is visible.
- Year 2 count is visible.
- Counts use the existing canonical year helper.
- No duplicated year logic exists in the page.
- Counts reconcile with the active Years 1–2 population.
- Cohort filtering preserves reconciliation.
- Country filtering preserves reconciliation.

---

## 8.7 Risk

**Low**

---

# 9. Early Support — Section 2.3 · Participation and Risk Level

## Monthly Trend — M1 → M6

## 9.1 Current state

The chart uses a line visualization with two series:

- Participation
- Medium+ Risk

The underlying metric and M1–M6 sequence are already correct.

---

## 9.2 Required behavior

Replace the line visualization with grouped **vertical bars**.

The underlying data must remain unchanged.

---

## 9.3 Visualization requirements

- X-axis: M1 through M6.
- Month order remains chronological.
- Participation and Medium+ Risk remain separate series.
- Both series use the same 0–100 percentage scale.
- Existing colors may remain unchanged.
- All month labels must remain visible where practical.
- Existing tooltip and legend behavior should be preserved.
- Existing equivalent tabular data remains available as the accessible numerical representation.

A reusable multi-series bar-chart component may be added if the existing chart primitives do not safely support this case.

---

## 9.4 Filters

Continue using the existing Scholar Status block filters.

No metric or query semantics change.

---

## 9.5 Acceptance criteria

- Chart is rendered as vertical bars.
- M1–M6 order is unchanged.
- Input data before and after the visualization swap is identical.
- Existing filters still affect the same query.
- Existing table values remain unchanged.
- Missing month data is not fabricated as zero.

---

## 9.6 Risk

**Low**

---

# 10. Early Support — Section 3 · Academic Progress

## GPA Distribution

## 10.1 Current defect

The current distribution uses:

`AcademicTerm.accumulatedGpa`

Production's Google Sheets sync does not reliably populate this field.

As a result, production-shaped data can produce an empty or incorrect distribution while other GPA views using `AcademicTerm.gpa` remain populated.

The issue is not the existing bucket boundaries.

---

## 10.2 Required source

Use:

`AcademicTerm.gpa`

---

## 10.3 Scholar GPA selection

For each scholar, select the latest academic term with a GPA satisfying all of the following:

- finite numeric value;
- greater than `0`;
- within the valid native country GPA range;
- associated with a real graded term.

Do not allow a later empty or forward-filled future term to replace the scholar's latest actual graded GPA.

This selection logic must be shared with existing GPA behavior where practical.

Do not maintain separate implementations of "latest valid GPA" for different dashboard sections.

---

## 10.4 GPA distribution

For Colombia:

- `< 3.5`
- `3.5 to < 4.0`
- `4.0 to 5.0`

These bucket boundaries remain unchanged.

Peru scholars must not be inserted into Colombia's buckets.

---

## 10.5 Denominator and excluded values

The UI must no longer make the three GPA bucket percentages look complete while silently omitting scholars.

The distribution must expose an excluded / not reported count covering cases such as:

- no valid GPA;
- future/ungraded-only records;
- GPA `0`;
- invalid GPA;
- Peru scholars when viewing Colombia-specific distribution buckets.

The implementation may choose an existing dashboard presentation primitive, but users must be able to understand how many scholars are represented by the three distribution percentages and how many are outside them.

---

## 10.6 GPA header KPI

Existing country-aware GPA summary behavior remains authoritative:

- Colombia-only scope → Colombia average on `/5`
- Peru-only scope → Peru average on `/20`
- mixed scope → scale-independent Academic Performance Index
- no data → empty state

The distribution must not imply that the mixed-country KPI and Colombia-only buckets use the same denominator.

---

## 10.7 Explicitly prohibited

Do not:

- convert Peru GPA to a Colombia scale;
- blend Colombia and Peru raw GPA;
- classify GPA `0` as `Below 3.5`;
- use future blank terms as the scholar's current GPA;
- migrate to `Cumulative GPA`;
- change GPA bucket boundaries without a new product decision.

---

## 10.8 Tests

At minimum add regression coverage for:

- `AcademicTerm.gpa` populated while `accumulatedGpa` is null;
- GPA 3.49;
- GPA 3.5;
- GPA 3.99;
- GPA 4.0;
- GPA 5.0;
- GPA 0 excluded;
- null excluded;
- negative excluded;
- above-scale excluded;
- latest future empty term does not mask latest valid GPA;
- Peru excluded from Colombia-specific buckets;
- mixed-country GPA summary remains country-aware;
- distribution respects Early Support filters;
- bucketed + excluded population reconciles with the intended distribution population.

---

## 10.9 Risk

**Medium**

This changes domain/query behavior but does not require schema evolution.

---

# 11. Program Ecosystem — Section 2 · Operating Partners

## 11.1 Current state

The dashboard currently:

- groups operators by country;
- shows a hero operator count;
- shows track badges and additional structural information;
- calculates scholar counts from `Scholar.operatorId`.

The Operator model is normalized and operator names are resolved from the source spreadsheet.

---

## 11.2 Required behavior

Simplify Section 2 to a stable four-row view:

- Fundación Antivirus para la Deserción — N scholars
- ESCALO — N scholars
- MAKERS — N scholars
- Confident English — N scholars

Remove from this section:

- country grouping;
- operator-count hero statistic;
- track badges where they do not contribute to the required view.

The product goal is to answer:

**Who are the four operators, and how many scholars are they supporting in the current scope?**

---

## 11.3 Filtering behavior

The four rows always remain visible.

Current filters affect the scholar count, not operator row visibility.

A filtered operator count may be `0`.

---

## 11.4 Source-of-truth constraint

Counts must use:

`Scholar.operatorId`

resolved through the normalized `Operator` entity.

Do not derive operator from country, university, cohort, or stage.

Do not use seed/default operator helpers to assign missing production relationships.

---

## 11.5 Missing operator assignment

Scholars with `operatorId = null` must not be assigned to an operator by inference.

If unassigned scholar records exist, the implementation should make that condition visible where useful rather than forcing the four operator counts to equal total scholar count.

The four counts are expected to reconcile with:

`scholars with a valid operator assignment`

not necessarily all scholars.

---

## 11.6 Production verification

Before marking this item complete, execute a read-only verification against production confirming the operator catalog.

Expected catalog:

1. Fundación Antivirus para la Deserción
2. ESCALO
3. MAKERS
4. Confident English

If the production catalog differs, stop and report:

`BLOCKED / DECISION REQUIRED`

Do not hide or rename unexpected production entities in the UI to force the expected result.

---

## 11.7 Acceptance criteria

- Exactly four canonical operator rows appear after production catalog verification.
- Each row displays operator name and filtered scholar count.
- All four remain visible under filters.
- Zero-count operators remain visible.
- Operator counts respect Cohort, Country, and University filters.
- No scholar is assigned by inference.
- Unresolved operator assignments remain unresolved.
- Country grouping is removed.
- Track badges are removed from this simplified presentation.
- Operator-count hero statistic is removed.

---

## 11.8 Risk

**Low–Medium**

Presentation is low-risk; production catalog verification is the main dependency.

---

# 12. Home — Section 2 · Reasons for Dropped Out

## 12.1 State

**BLOCKED — SOURCE DATA REQUIRED**

The current dashboard intentionally shows a pending state because no authoritative drop-out-reason field is represented in the current repository contract.

The requested spreadsheet coordinate `BB` does not match the last-known repository-backed sheet layout.

Column letters must not be treated as a durable contract.

---

## 12.2 Required source evidence

Before implementation, obtain:

1. exact spreadsheet/file identity;
2. exact tab name;
3. both header rows where applicable;
4. verbatim semantic header corresponding to the requested drop-out reason;
5. approximately 20 representative anonymized values;
6. confirmation that historical withdrawn scholars are populated;
7. null/blank semantics;
8. whether values are controlled-list or free text.

---

## 12.3 Intended final behavior

Once the source is confirmed:

- ingest the semantic drop-out reason field;
- preserve the raw source meaning;
- aggregate reasons for scholars in the Drop Outs scope;
- show reason counts;
- show blanks as `Not reported`;
- reuse existing Drop Outs Cohort / Country / University block filters.

No spreadsheet letter may be referenced directly by presentation code.

---

## 12.4 Expected technical impact

Likely:

- Prisma schema field;
- new migration;
- Apps Script normalization mapping;
- Apps Script unmapped-field documentation update;
- source contract update;
- admin import adapter update;
- validation update;
- dashboard query update;
- dashboard type update;
- Home UI update;
- tests.

The exact changes are not implementation-authorized until the source header is confirmed.

---

## 12.5 Governance

This item requires a data review.

If the new source materially changes ADR-007's ingestion contract, update ADR-007 or add a bounded follow-up decision record rather than silently changing the ingestion model.

---

# 13. Home — Section 6 · Program Satisfaction

## 13.1 State

**BLOCKED — SOURCE DATA REQUIRED**

Program Satisfaction comes from a separate spreadsheet that is not currently represented in the repository.

No existing dashboard data source may be substituted.

---

## 13.2 Required integration contract

Before implementation, obtain:

1. spreadsheet identity / Drive source;
2. tab name;
3. header structure;
4. anonymized representative sample;
5. scholar identifier or aggregation identifier;
6. satisfaction scale;
7. value polarity;
8. response date;
9. semester/period field;
10. denominator rule;
11. multiple-response rule;
12. anonymity rules;
13. expected relationship to Cohort / Country / University filters.

---

## 13.3 Scholar identity requirement

Where satisfaction is scholar-linked, it must resolve to the canonical scholar identifier.

Do not silently resolve records using:

- name;
- email;
- fuzzy matching.

If the survey is anonymous, its aggregation contract must be explicitly defined before implementation.

---

## 13.4 Period requirement

The product requirement includes semester-aware satisfaction reporting.

The current Home filter model does not expose a semester dimension.

The eventual integration must therefore explicitly decide whether satisfaction uses:

- latest completed semester automatically;
- a new semester filter;
- or another approved period rule.

Do not invent this behavior during implementation.

---

## 13.5 Governance

Program Satisfaction is a new external data integration.

Once the source contract is available, it requires:

- a new ADR or equivalent repository-governed integration decision;
- likely a persistence model and migration;
- source ingestion design;
- validation rules;
- tests.

This must be implemented separately from the ready dashboard corrections.

---

# 14. Filter Contract

Existing filter semantics remain unchanged unless explicitly stated.

| Metric | Cohort | Country | University | Required behavior |
|---|---|---|---|---|
| Drop-out reasons | Yes | Yes | Yes | Reuse existing Drop Outs block scope once implemented |
| Retention | Yes | Yes | Yes | No change |
| Vulnerability | Yes | Yes | Yes | No change |
| Satisfaction | TBD | TBD | TBD | Defined only after source contract |
| Year 1 / Year 2 | Yes | Yes | Yes | Existing Early Support scope |
| Monthly Trend | Yes | Yes | Yes | Existing Scholar Status block |
| GPA Distribution | Yes | Yes | Yes | Existing Early Support scope |
| Operating Partners | Yes | Yes | Yes | Counts filtered, four rows remain visible |

No unrelated filter-scope expansion is authorized.

---

# 15. Implementation Phases

Implementation should be split into bounded, independently reviewable phases.

---

## Phase 1 — Low-risk UI corrections

### Scope

1. Remove retention target row.
2. Add Year 1 / Year 2 counts.
3. Convert monthly trend to vertical bars.

### Risk

Low.

### Expected capability

Standard implementation tier.

### No migration

Required.

---

## Phase 2 — GPA distribution correctness

### Scope

1. Introduce/reuse a shared latest-valid-graded-GPA selector.
2. Refactor Early Support GPA distribution onto `AcademicTerm.gpa`.
3. Exclude zero/ungraded/invalid GPA.
4. Preserve country-native GPA semantics.
5. Expose excluded/not-reported denominator.
6. Add production-shaped regression tests.

### Risk

Medium.

### Expected capability

Strong implementation tier.

### Independent review

Required before closure because the change affects data semantics and a subtle production-only failure mode.

---

## Phase 3 — Vulnerability + Operating Partners

### Scope

1. Publish Vulnerability Level using source-faithful wording.
2. Simplify Operating Partners presentation.
3. Verify production Operator catalog.
4. Preserve stable four-row operator presentation.

### Risk

Low–Medium.

### Expected capability

Standard implementation tier.

---

## Phase 4 — Drop-out Reasons

**Blocked until Section 12 source gate is satisfied.**

Expected to require:

- schema migration;
- production ingestion change;
- manual Apps Script deployment;
- query/UI work;
- data review.

Route separately once unblocked.

---

## Phase 5 — Program Satisfaction

**Blocked until Section 13 source gate is satisfied.**

Route as a separate integration after its data contract and ADR are established.

---

# 16. Testing Requirements

Every implementation phase must add or update focused regression tests.

Do not rely exclusively on dashboard screenshots or seeded demo data.

Required project validation after each applicable phase:

```text
npm run lint
npm test
npx tsc --noEmit
npm run build
```

For changes involving real Prisma reads or integration logic:

```text
npm run test:integration
```

Where repository scripts differ, use the current repository-defined commands and report exact outcomes.

`npm run dashboard:check` may be used as supplementary evidence but is not sufficient by itself for GPA correctness because seeded data can populate fields the production sync does not.

---

# 17. Visual Validation

For user-facing changes, validate the affected dashboard routes in a real browser where tooling is available.

At minimum inspect:

- desktop layout;
- narrow viewport behavior;
- empty/zero states;
- filtered states;
- labels and legends;
- no obvious regression in section hierarchy.

Do not claim visual QA if it was not actually performed.

---

# 18. Data and Security Constraints

This specification does not change permission boundaries.

Implementation must preserve:

- current server-side authorization;
- canonical scholar identity;
- scholar access scoping;
- risk classification authority;
- existing PII handling rules.

Do not solve any unrelated authorization issue as part of this work.

If implementation discovers that one of these changes requires altering a permission or data-visibility contract, return:

`BLOCKED / DECISION REQUIRED`

---

# 19. Documentation Requirements

During implementation:

- keep this SPEC updated with meaningful decisions or blockers;
- do not duplicate durable decisions into multiple conflicting docs;
- update current-state documentation only when implementation changes actual behavior;
- update ADR-007 only if the ingestion contract changes materially;
- create a new integration ADR for Program Satisfaction once its source is known;
- do not create an ADR for GPA Option A, retention row removal, Year counts, chart type, or the vulnerability wording change.

After all ready phases are validated, record closure evidence here before moving this SPEC to `resources/specs/completed/`.

Blocked phases may remain explicitly deferred if the repository's governance allows the SPEC to close with separate planned follow-up tasks; otherwise keep the SPEC active until those items are resolved.

---

# 20. Implementation Freedom

The implementation agent may choose:

- exact component decomposition;
- exact reusable chart component name;
- presentation primitive for Year counts;
- presentation primitive for vulnerability distribution;
- internal helper naming;
- exact test-file organization;

provided that these choices do not change:

- product semantics;
- data authority;
- GPA scale rules;
- filter contracts;
- operator identity;
- authorization;
- acceptance criteria.

Implementation convenience may not redefine product behavior.

---

# 21. Acceptance Criteria Summary

SPEC-004's currently unblocked scope is successful when:

1. `OVERALL · TARGET | PENDING` is removed from Program Retention.
2. Year 1 and Year 2 scholar counts are visible and reconcile with the Early Support population.
3. Monthly Trend M1–M6 uses vertical bars without metric changes.
4. GPA Distribution uses production-backed `AcademicTerm.gpa`.
5. GPA `0` and ungraded/future terms do not count as failing GPA.
6. Colombia and Peru raw GPA scales remain separate.
7. GPA distribution exposes excluded/not-reported population.
8. Vulnerability Level displays High / Moderate / Low vulnerability using source semantics.
9. Pending/unrecognized vulnerability values remain visible as unclassified.
10. Operating Partners displays the four canonical operators with filtered scholar counts.
11. All four operator rows remain visible even at zero.
12. Operator assignment is never inferred from geography or stage.
13. Existing filter semantics remain intact.
14. Baseline authorization behavior remains intact.
15. Required tests and repository validation pass.
16. Visual validation confirms no dashboard regression.

The following remain explicitly blocked and must not be fabricated:

17. Drop-out Reasons until the semantic source field is confirmed.
18. Program Satisfaction until the separate source spreadsheet contract is supplied.

---

# 22. Readiness

## Phase readiness

### Phase 1
`IMPLEMENTED`

### Phase 2
`IMPLEMENTED`

### Phase 3
`IMPLEMENTED — PRODUCTION RECOVERY PENDING`. Production verification ran and **failed**: the
Operator catalog is empty and all 236 scholars are unassigned. Reference-data provisioning is
implemented but not yet deployed or resynced in production (see §24).

### Phase 4 — Drop-out Reasons
`DEFERRED — MOVED TO SPEC-006`. Still `BLOCKED — SOURCE DATA REQUIRED`; §12 is now governed by
`resources/specs/planned/006-drop-out-reasons.md` and no longer holds this spec open.

### Phase 5 — Program Satisfaction
`DEFERRED — MOVED TO SPEC-007`. Still `BLOCKED — SOURCE DATA REQUIRED`; §13 is now governed by
`resources/specs/planned/007-program-satisfaction.md` and no longer holds this spec open.

---

# 23. Overall SPEC State

`PARTIALLY IMPLEMENTED — PHASE 3 PENDING PRODUCTION RECOVERY`

Phases 1–3 are implemented and were re-verified against `main @ 58575cf` on 2026-09-23 (§25).
Phase 3 is **not accepted**: its production Operator-catalog gate (§11.6) was checked and failed —
the catalog is empty and all 236 scholars are unassigned. The reference-data provisioning that
fixes this **is now deployed to production** (§25.2), but the operator seed has not been run there
and no source-driven resync has been validated there.

This specification is therefore held open by exactly one thing: the §11.6 production recovery.
Both remaining actions require credentials and system access that are not available to the
repository toolchain (§25.3).

Phases 4–5 no longer hold this specification open. Their source-data gates are unchanged and
unsatisfied, but they now have independent governance as SPEC-006 and SPEC-007 (§25.5). They were
neither fabricated nor silently dropped.

Implementation must not use assumptions or placeholder data to bypass any of these gates.

---

# 24. Implementation Record

## Phase 1 — Low-risk UI corrections · `IMPLEMENTED`

- `OVERALL · TARGET | PENDING` removed from Program Retention; the `ACTUAL` and
  per-country rows and every retention percentage are unchanged.
- Year 1 / Year 2 head counts published in Early Support §1, read from the existing
  `getHomeOverview().scholarsByYear`, which derives them from `programYearFromSemester`.
  No new year logic was introduced.
- Monthly Trend M1→M6 converted from lines to grouped vertical bars via a new
  `GroupedBarCard` primitive. The query is untouched; months with no data remain `null`
  rather than being plotted as zero; the equivalent table is unchanged.

## Phase 2 — GPA distribution correctness · `IMPLEMENTED`

- Added `src/lib/academic/latest-gpa.ts` as the single "latest valid graded GPA" selector,
  reading `AcademicTerm.gpa`.
- Four consumers now share it: the Early Support GPA distribution, the Early Support GPA
  header KPI, `getExecutiveOverview`'s GPA summary, and the scholar directory's
  `latestGpa`. `getGpaByCohort`'s inline implementation of the same rule was replaced by
  the shared helper rather than left as a second copy.
- `GpaDistribution` now carries `excludedNoGradedGpa` and `excludedOtherScale`; the UI
  states the bucket denominator and both excluded populations.
- Colombia/Peru native scales and the mixed-country Academic Performance Index are
  unchanged.
- Regression coverage is production-shaped (`gpa` set, `accumulatedGpa` null) —
  `tests/academic/latest-gpa.test.ts` and `tests/integration/gpa-distribution.test.ts`.

### Behavior found outside the stated SPEC scope

§10 describes the defect as affecting the GPA **distribution**. The Early Support GPA
**header KPI** read the same unpopulated column and was equally empty against production
data, as did `getExecutiveOverview` and the scholar directory. All were migrated under
§10.3 ("do not maintain separate implementations of latest valid GPA").

`accumulatedGpa` remains in use where the semantics really are cumulative: the scholar
profile's "Cumulative GPA" chip and GPA trend, the import adapters/templates/validation,
and the seed. Per D1 these were left unchanged.

## Phase 3 — Vulnerability + Operating Partners · `IMPLEMENTED — PRODUCTION RECOVERY PENDING`

- Vulnerability vocabulary renamed from `TIER_1/2/3` to `HIGH/MODERATE/LOW`;
  `src/lib/scholars/socioeconomic-tier.ts` became
  `src/lib/scholars/vulnerability-level.ts`. The `TIER_MAPPING_APPROVED` gate and the
  placeholder tier labels are removed. Source mapping is unchanged.
- Home §4 publishes High / Moderate / Low vulnerability with percentages over classified
  scholars only, and reports pending and unrecognized separately — they are kept distinct
  through the parser, query and type layers.
- Operating Partners simplified to one row per operator (name — N scholars). Country
  grouping, the operator-count hero statistic and the track badges are removed; the
  now-orphaned `DeliveryPartnerGroup` component was deleted.
- `ProgramEcosystemResult.scholarsWithoutOperator` added for §11.5; operator assignment is
  still read only from `Scholar.operatorId` and is never inferred.
- Coverage: `tests/scholars/vulnerability-level.test.ts`,
  `tests/integration/vulnerability-and-operators.test.ts`.

### Production verification result — §11.6 gate FAILED

Production was checked read-only. The Operator catalog does not conflict with the expected
four entities; it is **empty**:

```sql
SELECT name, country, track FROM "Operator" ORDER BY track, name;
-- 0 rows
```

```sql
SELECT COUNT(*) AS total_scholars,
       COUNT("operatorId") AS scholars_with_operator,
       COUNT(*) - COUNT("operatorId") AS scholars_without_operator
FROM "Scholar";
-- total_scholars = 236, scholars_with_operator = 0, scholars_without_operator = 236
```

```sql
SELECT "operatorId", COUNT(*) FROM "Scholar" WHERE "operatorId" IS NOT NULL GROUP BY 1;
-- 0 rows
```

So Operating Partners renders four rows locally (where the demo seed creates the catalog) and
zero rows in production. This is a data condition, not a defect in the Phase 3 presentation
work: the section correctly shows the catalog as it finds it.

### Root cause

`Operator` has **no production writer**. The table is only ever populated by `prisma/seed.ts`,
which is demo data and must not run against production, and by test fixtures. Production
deployment runs `prisma migrate deploy` and nothing else, and no migration inserts rows.

With the table empty, `loadValidationContext()` builds an empty `operatorsByName`, the
controlled `FATV` alias registration no-ops (it is guarded on the canonical row existing), and
`validate.ts` resolves no operator for any scholar. Because an unrecognized operator
deliberately does not reject the scholar row, every sync has succeeded while leaving all 236
scholars unassigned — silently.

The authoritative source column is present and populated. The repository sample export of this
sheet carries `Current Operator -  Support Services` with exactly four values across its 236
rows: `FATV` (140), `ESCALO` (57), `MAKERS` (27), `Not applicable` (12). `Confident English`
does not appear in the source column today; it is a real program operator with no current
traffic, so it is expected to hold zero scholars after recovery.

### Remaining gate

§11.6 / §21 criterion 10 — **PENDING PRODUCTION RECOVERY**.

Reference-data provisioning is implemented (`npm run db:seed:operators`,
`prisma/seed-operators.ts`), but it has not been deployed or run against production, and no
source-driven resync has been validated there. The recovery sequence is documented in
`docs/DEVELOPMENT.md` ("Recovering scholars left with no operator"): deploy → run the operator
seed → verify the catalog → trigger the normal Google Sheets sync → verify assignment counts.

No scholar may be assigned by hand or by inference from country, cohort, semester or program
stage; the source column is the only authority.

Re-run all three queries above against production after that sequence to close the gate. The
catalog must then contain the four canonical rows, and `scholars_without_operator` should fall
to the number of scholars whose source value is genuinely `Not applicable`.

## Phases 4 and 5

Not implemented. Both remain `BLOCKED — SOURCE DATA REQUIRED` per §12 and §13. As of 2026-09-23
they are governed by SPEC-006 and SPEC-007 respectively — see §25.5.

---

# 25. Closure Audit — 2026-09-23

A closure pass was run against `main @ 58575cf278898324a46c96d40d730301c05757ed` to determine
whether this specification could be accepted and moved to `completed/`.

**Outcome: it could not.** The specification remains `ACTIVE`. The §11.6 production gate is still
open, and the two actions that would close it cannot be performed by the repository toolchain.

## 25.1 Implementation re-verification

Every Phase 1–3 acceptance area was re-read in the current code. All verified; none regressed.

| Area | Evidence |
|---|---|
| Retention target row absent | `getProgramRetention()` returns `target: null` (`queries.ts:1651`); Home builds `retentionRows` from `rows` + `overall` + `byCountry` only (`page.tsx:135–160`). No `TARGET` row is emitted. |
| Year 1 / Year 2 counts | `early-support/page.tsx:198` reads `home.scholarsByYear`, built in `queries.ts:511–517` from `programYearFromSemester`. No new year logic. |
| Grouped vertical bars | `GroupedBarCard` (`components/charts.tsx:151`) used at `early-support/page.tsx:477`. |
| Missing months stay missing | `toWholePct` keeps monthless points `null`; the bar is absent rather than plotted as zero (`early-support/page.tsx:474–483`). |
| GPA reads `AcademicTerm.gpa` | `selectLatestGradedGpa` reads `gpa`; `latest-gpa.ts` documents why `accumulatedGpa` is the wrong column. |
| Latest-GPA logic shared | One definition in `lib/academic/latest-gpa.ts`; the only caller site is `queries.ts:329`, feeding every consumer. No second copy. |
| `0` / invalid / out-of-range never become failing GPA | `selectLatestGradedGpa` counts `gpa === 0` into `excludedZeroGpaCount` and skips it; `isGradedGpa` requires `> 0` and `<= GPA_SCALE_MAX[country]`. Invalid rows are never written, so a later ungraded term cannot displace an earlier real grade. |
| Colombia / Peru native scales distinct | `GPA_SCALE_MAX[country]`; `gpaByCountry` is accumulated per country and never blended (`queries.ts:1089`). |
| Excluded populations explicit | `excludedNoGradedGpa` / `excludedOtherScale` populated at `queries.ts:1112–1113`, rendered at `early-support/page.tsx:672–676`. |
| Vulnerability HIGH / MODERATE / LOW | `lib/scholars/vulnerability-level.ts`; no `TIER_*` or `TIER_MAPPING_APPROVED` identifier remains anywhere in `src/` or `tests/`. |
| Pending vs unrecognized kept separate | `VulnerabilityLevelParse.status` is `OK` / `PENDING` / `UNRECOGNIZED`, distinct through parser, query and type layers. |
| Operating Partners reads `Scholar.operatorId` | `queries.ts:1460–1461` counts by `s.operatorId` only. |
| No inference path | `defaultOperatorName()` is referenced **only** by `prisma/seed.ts` and its own unit test — no production import or query path calls it. `validate.ts:497–504` resolves by name against the catalog and never auto-creates an operator. |
| Country grouping / hero count / track badges removed | `actors/page.tsx:96–121` renders one flat row per operator; `DeliveryPartnerGroup` no longer exists. |
| `prisma/seed-operators.ts` insert-only / idempotent | `provisionOperators()` classifies before writing, inserts only missing rows, never rewrites an existing row, and is conflict-atomic — one disagreeing row abandons the whole run. |
| Canonical catalog in one reference-data layer | `CANONICAL_OPERATORS` in `src/lib/data-import/reference-data.ts`, names from `OPERATOR_NAMES`. |
| `FATV` resolves only after the canonical row exists | `validation-context.ts:36–40` registers the alias under `if (id)` — with no canonical row, the alias registration no-ops. |

No contradiction was found between this specification and the current code.

## 25.2 Production deployment state — RESOLVED

§24 recorded the reference-data fix as "not yet deployed". That is no longer true.

The production alias resolves to deployment `dpl_7mK3MgHKMHCnTyQEitTRezn24nCM`
(`target: production`, `readyState: READY`, created 2026-09-22 20:01 UTC-3), built from
`githubCommitSha 58575cf278898324a46c96d40d730301c05757ed` on `main`.

That commit contains `92f2c4a` (canonical operator reference data), `21b6efd` (scholar operator
mapping in manual import) and `fbea9d0` (conflict-atomic provisioning). **The code side of the
recovery is live in production.**

## 25.3 Production recovery — BLOCKED

Neither remaining step could be executed.

### Blocker 1 — no production database access

`npm run db:seed:operators` needs the production `DATABASE_URL`. On this Vercel project
`DATABASE_URL`, `DIRECT_URL`, `POSTGRES_URL`, `POSTGRES_URL_NON_POOLING`, `POSTGRES_PRISMA_URL`
and `POSTGRES_PASSWORD` are all marked **sensitive**, so `vercel env pull --environment=production`
returns `[SENSITIVE]` placeholders rather than values. Only the non-secret host is retrievable
(`db.herfxgdfjsjbvdqpuqsh.supabase.co`).

The Supabase CLI is authenticated and can see the project, but offers no command that runs SQL
against a remote project without that same database password.

Consequence: the §11.6 pre-recovery read-only snapshot **could not be refreshed**. The production
numbers in §24 (0 operator rows / 236 scholars / 236 unassigned) remain the last verified reading,
taken during the original Phase 3 verification — they were **not** re-confirmed on 2026-09-23.

### Blocker 2 — no way to trigger the authoritative sync

Step 4 of the recovery (`docs/DEVELOPMENT.md`, "Recovering scholars left with no operator")
requires running `apps-script/Sync.gs` inside the program's Google Sheet. That script is not
deployed from this repository — there is no `clasp` wiring, and a `git push` does not deploy it.
Triggering it requires access to the Sheet itself.

No substitute is acceptable: per §11.4/§11.5 a direct `operatorId` write, a SQL backfill, or any
match on country / university / cohort / stage is prohibited. The source column is the only
authority.

## 25.4 Remaining actions to close this specification

To be performed by a maintainer with production and Google Sheet access:

1. Run `npm run db:seed:operators` with the production `DATABASE_URL`. Expect four rows created.
   If it reports a conflict it writes nothing — stop and escalate rather than normalizing by hand.
2. Verify the catalog:
   ```sql
   SELECT name, country, track FROM "Operator" ORDER BY track, name;
   ```
3. Trigger the normal Google Sheets sync (`apps-script/Sync.gs`), which re-POSTs
   `NORMALIZED_SCHOLAR` to `/api/sync/import`.
4. Verify assignment:
   ```sql
   SELECT COUNT(*) AS total_scholars,
          COUNT("operatorId") AS scholars_with_operator,
          COUNT(*) - COUNT("operatorId") AS scholars_without_operator
   FROM "Scholar";

   SELECT o.name, COUNT(s."scholarId") AS scholars
   FROM "Operator" o
   LEFT JOIN "Scholar" s ON s."operatorId" = o.id
   GROUP BY o.id, o.name
   ORDER BY o.name;
   ```

Acceptance is **not** a fixed `224 / 12`. The rule is: all four canonical rows exist (including
zero-count ones), source-recognized operators resolve, source `Not applicable` stays null, and no
assignment is invented. The repository sample split (`FATV` 140, `ESCALO` 57, `MAKERS` 27,
`Not applicable` 12) is context only — production is authoritative.

## 25.5 Deferred scope — moved out

Phases 4 and 5 were removed from this specification's critical path so its source-ready scope is
not held open indefinitely by external data that may never arrive on this timeline.

| Was | Now | Status |
|---|---|---|
| §12 — Drop-out Reasons | `resources/specs/planned/006-drop-out-reasons.md` | `PLANNED / BLOCKED — SOURCE DATA REQUIRED` |
| §13 — Program Satisfaction | `resources/specs/planned/007-program-satisfaction.md` | `PLANNED / BLOCKED — SOURCE DATA REQUIRED` |

§12 and §13 are retained above as the record of what was decided. Neither requirement was
fabricated, implemented, or silently dropped: both carry their full source gates forward, and
neither may be implemented until those gates are satisfied.

## 25.6 Repository validation at audit time

Run against `main @ 58575cf`, working tree clean:

| Command | Result |
|---|---|
| `npm run lint` | PASS — 0 errors, 1 pre-existing `no-img-element` warning (`ScholarAvatar.tsx:45`) |
| `npm test` | PASS — 47 files, 327 tests |
| `npm run test:integration` | PASS — 11 files, 98 tests |
| `npm run build` | PASS |
| `npm run dashboard:check` | PASS — every dashboard query ran against seeded data |
| `git diff --check` | PASS |
| `npx tsc --noEmit` | 2 pre-existing errors in `tests/request-dedup.test.ts` (Prisma mock typing). Present on unmodified `main`; outside SPEC-004 scope and not addressed here. |

No UI verification against production-backed data was performed — §11 UI acceptance depends on
recovered production data that does not exist yet, and no browser tooling was used in this pass.