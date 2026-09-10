# SPEC-004 — Dashboard Filter Scope and Scholar Semester Display

Status: Active

## Goal

Make dashboard filter behavior explicit and consistent across pages, and improve the Scholar Profile so the current semester clearly identifies which academic semester is being shown.

The intended filter hierarchy is:

`Global/Page Filters -> Block Filters -> Block Content`

Global filters define the page-level dataset. Block filters re-scope only their owning block. When any global filter changes, all block-level filters on that page reset to their default state.

A block filter's default state means **inherit global**: unset, the block reads whatever the page is
scoped to. Set, it overrides the global value for that block alone — with global `Country=Colombia`
and block `Country=Peru`, that block shows Peru while its sibling sections stay on Colombia. An
unset block value never blanks the global value it inherits.

## Context

Two UI behavior adjustments are required:

1. The Scholar Profile needs to make the meaning of the current semester explicit. For example, `2026-2` means the second semester of 2026.
2. Dashboard filters need clear scope. Top filters apply to the whole page, while filters below a section title apply only to that section/block.

This is a UI/domain-behavior task. It should not change database schema, ingestion behavior, spreadsheet mappings, risk semantics, canonical scholar identity, or authorization.

## Scholar Profile — Current Semester

The field must name the semester in words. The year is parsed from the stored value but is not
displayed — the raw term code never appears in the visible value.

For example:

- `2026-1` -> `First semester`
- `2026-2` -> `Second semester`
- `2025-2` -> `Second semester`

Equivalent wording is acceptable if it matches the existing design system.

Requirements:

- do not hardcode the year;
- derive the semester number from the actual value;
- do not show the year or the raw `YYYY-N` code in the rendered value;
- if semester is `1`, identify it as first semester;
- if semester is `2`, identify it as second semester;
- for an unexpected/non-standard value, show the original value without inventing a meaning;
- for a missing value, preserve the application's established missing-data presentation;
- prefer a small reusable formatter/helper if semester display logic is or may be reused elsewhere.

This applies only to `Current Semester` on the Scholar Profile, which renders `AcademicTerm.term`.
`Scholar.currentSemester` — the ordinal count rendered as `Semester` in Full Record — is a
different value and is not affected.

## Filter Scope Model

### Global / top filters

Filters at the top of a dashboard page apply to all applicable content on that page.

Conceptually:

```text
raw page dataset
      |
      v
global/page filters
      |
      v
page-filtered dataset
```

Each block must operate from this already globally filtered dataset.

### Block / section filters

Filters located below or inside a section belong only to that section.

Conceptually:

```text
page-filtered dataset
      |
      v
block-specific filters
      |
      v
block-specific cards / tables / charts
```

Changing a block filter must not change sibling sections or global filters.

## Home Page — `1 · Our Scholars`

The filters associated with `1 · Our Scholars` must filter the entire `Our Scholars` block, including at minimum:

- `Total Scholars`
- `Active Women`
- `Total by Cohort`

All three must use the same locally filtered scholar population.

The block filter must not affect unrelated Home page sections.

Avoid situations where cards and tables inside the same block use different filter state or different populations.

## Apply the Same Behavior Across Other Pages

**Every block-level filter already present in the dashboard must be functional and scoped to its
owning block** — this is not a Home-only change. Audit the whole project for sections that already
expose a filter row, and make each one actually filter its own section.

Apply the same rules consistently:

- top filters -> whole page;
- section filters -> owning section only;
- section filters operate on the already globally filtered dataset.

Do not mechanically add local filters to sections that do not already have them.

Do not change metric definitions simply to standardize filter implementation.

The sections that expose a filter row today:

| Page | Section | Filters | Affects |
|---|---|---|---|
| Home | `1 · Our Scholars` | Cohort, Country, University | Total Scholars, Active Women, Total by Cohort |
| Home | `2 · Drop Outs` | Cohort, Country, University | Total Scholars Withdrawn, Total Women Withdrawn |
| Home | `3 · Program Retention` | Cohort, Country, University | the four retention hero stats and the retention table |
| Early Support | `2 · Scholar Status` | Cohort, Country, University | 2.1–2.6 and the participation cards under that heading |

A section that feeds several cards from one query keeps doing so; a section fed by several queries
(Early Support's) must pass the same block scope to every one of them. Where a query also feeds a
section that exposes no filter, call it twice rather than letting the block scope leak.

## Shared Filter UI

Global and block filters use one select implementation. Block filters must not introduce a second
visual implementation: they render as the scope chips they replaced, taking their tone per filter
key from the existing chip tone mapping, so a section looks unchanged but is now interactive.

## Reset Behavior

Whenever **any global/top filter value changes**, reset **all block-level filters on that page** to their default/unselected state.

Example before changing a global filter:

```text
Country: Colombia        <- global
Cohort: 2025             <- global

Our Scholars:
Gender: Women            <- local

Another section:
Status: At Risk          <- local
```

After changing `Country` to Peru:

```text
Country: Peru
Cohort: 2025

Our Scholars:
Gender: All/default

Another section:
Status: All/default
```

Requirements:

- changing a global filter resets local/block filters;
- do not reset other global filters unless existing dependency rules require it;
- changing only a block filter must not reset global filters;
- changing only a block filter must not reset sibling block filters;
- the reset must happen when the global filter value actually changes, not simply because a component re-renders;
- avoid effect/render loops.

## Clear / Reset Controls

Preserve existing clear/reset UX.

- A block-level `Clear`, `All`, or equivalent action resets only that block.
- A page/global clear action follows existing page behavior and must leave block filters in their default state.

Do not introduce conflicting reset semantics.

## State Ownership

Keep filter state ownership explicit.

Prefer a structure conceptually equivalent to:

```ts
globalFilters

blockFilters = {
  ourScholars: ...,
  academicSupport: ...,
  psychosocialSupport: ...,
}
```

Do not force this exact implementation if the repository already has an appropriate abstraction.

Reuse existing hooks/context/selectors where appropriate. If a shared abstraction is needed, keep it small and typed.

## Domain / Query Logic

Keep filtering and aggregation logic out of presentation components where practical.

Avoid duplicating independent filter chains across cards and tables.

Prefer a single clear data flow, conceptually:

```ts
const globallyFilteredScholars = applyGlobalFilters(...)
const ourScholarsData = applyOurScholarsFilters(
  globallyFilteredScholars,
  ourScholarsFilters
)
```

Cards, tables, and charts in the same block should consume the same block-level population.

## Implementation Audit

Before a major refactor, inspect and briefly document:

1. where global filter state currently lives;
2. where block-level filter state currently lives;
3. whether global and local filters currently share an ambiguous state object;
4. where filtered datasets are calculated;
5. whether filtering/aggregation business logic currently lives inside React components;
6. which dashboard pages currently expose global and block filters;
7. which cards/tables/charts belong to each block.

Prefer adapting the existing architecture rather than replacing the entire filter system.

## Non-Goals

Do not change:

- canonical scholar identity;
- database schema;
- Prisma migrations;
- ingestion behavior;
- source spreadsheets;
- spreadsheet mappings;
- risk calculations or source-of-truth rules;
- metric definitions;
- authorization or role behavior;
- unrelated dashboard design.

If a schema change appears necessary, stop that portion and report why rather than including an unrelated migration in this task.

## Acceptance Criteria

### Scholar semester

- `2026-1` is displayed as first semester.
- `2026-2` is displayed as second semester.
- The year is derived from the actual value and is not hardcoded.
- Unexpected semester values are not falsely labeled.
- Missing values use the established missing-data behavior.

### Global filters

- A global filter affects all applicable blocks on the page.
- Blocks operate from the page-filtered dataset rather than independently re-reading raw/unfiltered data.

### Block filters

- A local filter affects only its owning block.
- On Home, the `Our Scholars` local filter affects `Total Scholars`, `Active Women`, and `Total by Cohort` consistently.
- Unrelated Home sections do not change when only the `Our Scholars` local filter changes.
- Equivalent block filters on other pages follow the same scope model.

### Reset behavior

- Set one or more block filters, then change any global filter -> all block filters on that page reset.
- The changed global filter remains selected.
- Other global filters remain selected unless existing dependency behavior requires otherwise.
- Changing only a block filter does not reset global filters.
- Changing only a block filter does not reset sibling block filters.

## Tests

Add focused regression tests for:

- `2026-1` -> first semester;
- `2026-2` -> second semester;
- non-hardcoded year handling;
- unexpected semester values;
- missing semester values;
- global filters affecting multiple blocks;
- block filters affecting only their owning block;
- Home `Our Scholars` cards/table sharing the same filtered population;
- global-filter changes resetting all local/block filters;
- local-filter changes not resetting global or sibling local filters.

Prefer behavior/domain tests over snapshots alone.

## UI / Design Constraints

Preserve the existing visual design unless a small adjustment is required for the semester label.

Inspect `resources/design-reference/` before changing spacing, typography, filter placement, or hierarchy.

The visual hierarchy should continue to make clear which filters are global and which belong to a specific block.

## Validation

Run the repository's actual validation commands from `package.json`.

At minimum, where available:

- targeted tests for changed filter/domain code;
- full test suite;
- type check;
- lint;
- production build.

If browser tooling is available, manually verify:

### Scholar Profile

- a scholar with `2026-1`;
- a scholar with `2026-2`.

### Home

1. load the page with default filters;
2. change one global filter;
3. verify multiple blocks change;
4. set a local `Our Scholars` filter;
5. verify `Total Scholars`, `Active Women`, and `Total by Cohort` change consistently;
6. verify unrelated sections do not change;
7. set local filters in more than one block;
8. change a global filter;
9. verify all block-level filters reset.

Repeat representative checks on other pages that contain both global and block filters.

Do not claim browser/visual QA if it was not actually performed.

## Self-Review

Before finishing, inspect the diff for:

- a local filter accidentally affecting the entire page;
- a global filter affecting only some applicable blocks;
- cards and tables in one block using different populations;
- block filters being applied to raw data instead of globally filtered data;
- block filters not resetting after global filter changes;
- global filters resetting after only a local filter change;
- sibling block filters resetting after only a local filter change;
- `useEffect` or state dependency loops;
- duplicated filtering logic across components;
- semester labels hardcoded to 2026;
- invalid semester values being incorrectly labeled;
- unrelated metric/data-semantic changes.

## Expected Governance Impact

- SPEC: this file owns the behavior change.
- ADR: not expected unless implementation requires a substantial architectural decision.
- Prisma migration: none expected.
- Security review: none expected because this task does not change visibility or permissions.
- Data review: none expected because no metric/source mapping/risk semantics change is intended.

## Commit Convention

Use Conventional Commits (`feat:`, `fix:`, `chore:`, `docs:`, `refactor:`, `test:`).

Use the configured repository git author as the sole author. Do not add `Co-Authored-By: Claude` or any other co-author attribution.

A likely implementation commit message is:

`fix: scope dashboard filters and clarify scholar semester`

Adjust only if the final implementation scope warrants a more accurate Conventional Commit message.

## Final Report

Report:

- files changed and why;
- current and final filter architecture;
- where global filter state lives;
- where block filter state lives;
- how page-filtered data reaches blocks;
- how local filtering is applied;
- confirmation that global filters affect the whole page;
- confirmation that block filters affect only their block;
- confirmation that Home `Our Scholars` cards/table share one filtered population;
- confirmation that global-filter changes reset block filters;
- confirmation that scholar semester identifies first/second semester;
- exact tests added/updated;
- exact validation commands and outcomes;
- any documentation updated;
- confirmation that there were no schema changes, Prisma migrations, or data backfills unless explicitly reported otherwise;
- deferred issues discovered but intentionally left out of scope.
