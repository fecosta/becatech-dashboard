Task: Correct SPEC-004 semester display and project-wide block filter behavior

Repository: fecosta/becatech-dashboard

Continue from the current local implementation of SPEC-004.

Do not discard the working implementation blindly. Audit the changes already made, preserve the parts that are correct, and adjust the behavior described below.

Update the active SPEC-004 to match these clarified requirements.

⸻

1. Scholar Current Semester — correction

The current implementation displays values such as:

2025-2 · Second semester
2026-2 · Second semester

This is not the desired UI.

Required display

The Current Semester field must display only the human-readable semester:

2026-1 → First semester
2026-2 → Second semester

The year and raw term must not appear in the visible value.

Examples:

2025-1 → First semester
2025-2 → Second semester
2026-1 → First semester
2026-2 → Second semester

The year must still be parsed dynamically; do not hardcode specific years.

Fallback behavior

Preserve these rules:

* valid YYYY-1 → First semester
* valid YYYY-2 → Second semester
* non-standard/raw value → display the original raw value unchanged
* missing value → existing DASH / — convention

Continue building the formatter on the existing parseSemester() logic.

If the current helper is called:

formatSemesterLabel(term)

it can remain with that name, but its output must change to the required display above.

Scope

Wire this formatter only into:

Current Semester

in the scholar profile, which renders AcademicTerm.term.

Do not change Scholar.currentSemester, which is the different ordinal value rendered as Semester in Full Record.

Tests

Update the semester tests to assert exactly:

2026-1 → First semester
2026-2 → Second semester
2025-2 → Second semester

Also preserve coverage for:

* non-standard raw values
* missing value

⸻

2. Block filters — correction to scope

The previous implementation only made the filters under:

1 · Our Scholars

functional.

That interpretation was too narrow.

Required behavior

Audit the entire dashboard project for places where block/section-level filters are already rendered.

Wherever a block has an existing filter UI underneath or associated with that block, that filter must actually filter the information belonging to that block.

Do not limit this change to the Home page.

The hierarchy remains:

Top/global filters
        ↓
page-wide filtered population
        ↓
block filter
        ↓
only that block's content

Important distinction

Do not invent block filters for sections that do not currently display them.

Instead:

1. find every section that already visually exposes a filter;
2. identify which cards/tables/charts belong to that section;
3. make that filter functional;
4. keep its effect scoped to that section only.

⸻

3. Audit all existing block filters before implementation

Before changing more code, perform a repository-wide audit.

Search for:

* FilterChipRow
* filter labels such as Country, Cohort, Semester, etc.
* existing filter components
* section headers with filter controls
* read-only filter chips
* selects or dropdowns rendered beneath section titles

Produce a compact mapping such as:

Page: Home
Section: 1 · Our Scholars
Filters: Country, Cohort
Affects:
- Total Scholars
- Active Women
- Total by Cohort
Page: <page>
Section: <section>
Filters: ...
Affects:
- ...

Do this for every existing block-level filter in the dashboard.

Then implement the behavior for all identified real block filters in this task.

Do not treat the Home block as the only implementation target.

⸻

4. Reuse the existing filter UI

The previous implementation created a new select/component specifically for Our Scholars.

That is not desired.

Required approach

Reuse the filter/select UI that the project already uses.

Do not introduce a visually different select just for block filters.

Inspect the existing design/filter implementation and identify the reusable component or styling already used by the dashboard.

The block filters should visually match the already-built filter UI.

The existing filter styling includes behavior equivalent to:

background-color: #27cf77;
color: #fff;
padding: 10px;
border: solid 2px #1a9054;
border-radius: 10px;
font-weight: bold;
appearance: none;
-webkit-appearance: none;
-moz-appearance: none;

Do not blindly duplicate these CSS declarations into multiple new components.

Instead:

* find the existing component/style responsible for this UI;
* reuse it;
* if necessary, extract a small shared reusable filter/select component from the existing implementation;
* keep one visual implementation for global and block selects where appropriate.

The goal is visual consistency.

⸻

5. Do not create a one-off OurScholarsFilters UI

Revisit the newly created:

OurScholarsFilters.tsx

If this component exists only to duplicate UI already available elsewhere, remove or refactor it.

A block-specific wrapper may exist if it owns block-specific URL parameters, but the actual select controls must use the existing shared UI.

Prefer something conceptually like:

<BlockFilters>
  <ExistingFilterSelect ... />
  <ExistingFilterSelect ... />
</BlockFilters>

rather than creating a second select implementation.

If TopFilters currently contains the only reusable select implementation, extract the visual select into an appropriately shared component rather than importing page-specific implementation details in the wrong direction.

For example, avoid architecture like:

OurScholarsFilters
    imports Select from TopFilters

if TopFilters is page-specific.

Prefer:

components/dashboard/FilterSelect
        ↑
TopFilters
        ↑
block filters

Use existing repository conventions for the actual path/name.

⸻

6. Filter state

Continue using URL state unless the repository audit demonstrates an existing better pattern.

Block-level URL keys must remain distinct from global keys.

For example:

country                 ← global
cohort                  ← global
ourScholarsCountry      ← block
ourScholarsCohort       ← block

Equivalent names are acceptable.

For additional blocks found during the audit, use clearly scoped keys.

Do not let two independent blocks accidentally share the same local URL key unless they are intentionally the same filter scope.

⸻

7. Inherit-global behavior

The default block filter state should mean:

inherit global

For example:

Global Country = Colombia
Block Country = default

means the block uses Colombia.

If:

Global Country = Colombia
Block Country = Peru

then that block uses Peru while sibling blocks continue using Colombia.

Conceptually:

effectiveBlockFilters = {
  ...globalFilters,
  ...definedBlockOverrides,
}

Do not replace a global value with an empty block value.

⸻

8. Block ownership

Every identified block-level filter must affect the complete logical block.

For example, 1 · Our Scholars must continue to use one common filtered population for:

* Total Scholars
* Active Women
* Total by Cohort

Likewise, for every other block found during the audit:

all cards/tables/charts inside that block must receive the same effective block filter unless there is an existing documented metric-specific reason not to.

Do not let the visual elements inside one block calculate against different filter scopes.

⸻

9. Global filter reset rule

Preserve the corrected reset rule:

Whenever any top/global filter changes, reset all block-level filters on that page.

This now applies to every block filter implemented in the project, not only Our Scholars.

Example:

Global:
Country = Colombia
Block A:
Cohort = 2025
Block B:
Country = Peru

After changing global Country to Peru:

Global:
Country = Peru
Block A:
Cohort = default/inherit
Block B:
Country = default/inherit

Do not reset unrelated global filters.

Do not use useEffect synchronization if URL-navigation helpers can implement this deterministically.

⸻

10. Local Clear behavior

Each block’s Clear action must clear only that block’s local filters.

Example:

Block A Clear

must not change:

* global filters;
* Block B filters;
* Block C filters.

A global/page Clear should continue to clear the applicable global state and leave all local filters at their defaults.

⸻

11. Existing global filter UI must remain unchanged visually

Do not redesign the global filter bar.

Do not create a second filter design language.

The existing filter control should be reused for:

* top filters;
* block filters;

where the same control type is appropriate.

The user should perceive these as the same UI component with different filtering scope.

⸻

12. Tests

Update/add regression tests covering the corrected behavior.

Semester

Assert:

2026-1 → First semester
2026-2 → Second semester
2025-2 → Second semester

plus:

* raw fallback
* missing fallback

Explicitly assert that output does not contain the year for valid semester values.

⸻

Home block

Verify:

Our Scholars local filter
→ Total Scholars changes
→ Active Women changes consistently
→ Total by Cohort changes consistently
→ sibling sections do not change

⸻

Other blocks

For every other existing block filter identified in the audit, add at least one representative test verifying:

change block filter
→ owning block changes
→ unrelated sibling block remains unchanged

Prioritize domain/helper tests where possible rather than brittle visual snapshots.

⸻

Reset behavior

Test with more than one block-filter namespace:

set Block A filter
set Block B filter
change global filter
→ Block A reset
→ Block B reset
→ global selection preserved

Also test:

change Block A
→ Block B unchanged
→ globals unchanged

⸻

13. Remove unnecessary incidental changes

Remove .claude/launch.json unless it is already an intentionally versioned project development file.

It should not be part of SPEC-004 merely because it was useful for local preview.

Do not include tooling configuration unrelated to product behavior in this delivery.

⸻

14. SPEC-004

Update:

resources/specs/active/004-dashboard-filter-scope-and-semester.md

to reflect the clarified requirements.

Specifically correct:

Semester

From:

2026-2 · Second semester

to:

Second semester

Filters

Make explicit that:

Every block-level filter already present in the dashboard must be functional and scoped to its owning block.

And:

Existing dashboard filter/select UI must be reused; block filters must not introduce a separate visual implementation.

⸻

15. Non-goals

Do not change:

* database schema;
* Prisma models/migrations;
* ingestion;
* canonical scholar identity;
* risk calculations;
* metric definitions;
* authorization;
* source spreadsheet formats.

Do not fix Selection Pipeline’s unrelated searchParams issue as part of this correction.

Do not expand semester formatting into Early Support unless that page is independently required by the block-filter work.

⸻

16. Validation

Run:

npm test
npm run lint
npm run build

Also run:

git diff --check

Manual browser QA must cover:

Scholar Profile

Confirm Current Semester displays:

First semester

or:

Second semester

without YYYY-N.

Filter UI

Confirm block filters visually reuse the existing green dashboard filter UI.

Check:

* background
* text color
* padding
* border
* border radius
* font weight
* native select appearance handling

Do not claim visual QA unless actually performed.

Filter scope

For every page where an existing block filter was found:

1. change the global filter;
2. verify applicable page data changes;
3. set a block-level filter;
4. verify only the owning block changes;
5. set another block filter where available;
6. change a global filter;
7. verify all local block filters on that page reset;
8. verify global filters remain intact except for the one deliberately changed.

⸻

17. Self-review

Before finishing, specifically check:

* Does Current Semester show only First semester / Second semester?
* Is any year still visible in that value?
* Did we accidentally change Scholar.currentSemester?
* Did we audit the whole dashboard for existing block filters?
* Is any existing block filter still read-only?
* Is block filtering still implemented only on Home?
* Did we create any one-off select styling instead of reusing the existing UI?
* Do cards/tables/charts in a block share one effective filter population?
* Can a block filter affect a sibling block?
* Does changing a global filter clear every local block filter on that page?
* Can clearing one block accidentally clear another?
* Is .claude/launch.json still in the diff unnecessarily?

Fix any failures before reporting completion.

⸻

18. Final report

Return:

Audit

List every existing block filter found:

Page
Section
Filters
Affected cards/tables/charts

Files changed

Explain each file.

Semester

Confirm exact output examples.

Shared filter UI

State which existing/shared component is now used by both global and block filters.

Filter architecture

Explain:

* global URL state;
* block URL state;
* effective merge;
* reset behavior.

Tests

List new/updated tests and exact count.

Browser QA

List routes and scenarios actually checked.

Validation

Report exact output from:

npm test
npm run lint
npm run build
git diff --check

Out of scope

List anything found but intentionally deferred.

Database

Explicitly confirm:

* no schema changes;
* no migrations;
* no backfills.