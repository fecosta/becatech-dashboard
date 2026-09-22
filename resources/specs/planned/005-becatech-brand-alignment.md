# SPEC-005 — BecaTech+ Brand Alignment

**Status:** PLANNED  
**Methodology state:** IMPLEMENTATION READY IN BOUNDED PHASES · VISUALIZATION PHASE DEPENDS ON SPEC-004 · BOOKMAN IMPLEMENTATION BLOCKED ON LICENSING  
**Repository baseline:** `main @ e4282725ceb95a5081191c3aa1d02ea4ac5527aa`  
**Depends on:** Completed SPEC-003 Dashboard UX/UI Refresh; official BecaTech+ Brand Manual integration  
**Partial dependency:** SPEC-004 — Dashboard Data & Visualization Corrections must be completed before brand work changes the visualization surfaces it owns.

**Relevant prior specs:**
- SPEC-001 — Scholar Profile Split
- SPEC-002 — Spreadsheet Ingestion Refactor
- SPEC-003 — Dashboard UX/UI Refresh
- SPEC-004 — Dashboard Data & Visualization Corrections

---

# 1. Purpose

Align the BecaTech+ Scholars Dashboard with the official 2026 BecaTech+ brand identity while preserving the characteristics required of a dense, accessible decision-support product.

This specification translates the official brand system into application behavior.

It does **not** require literal reproduction of marketing or communication-piece rules where doing so would reduce:

- accessibility;
- data readability;
- semantic clarity;
- information density;
- interaction affordance;
- responsive behavior;
- chart differentiation;
- operational usability.

The intended result is:

> a BecaTech+ product that is recognizably and consistently on-brand while remaining a trustworthy, accessible, data-dense application.

The brand manual defines the identity.

This specification defines how that identity is adapted to the interactive dashboard.

---

# 2. Authoritative Sources

## 2.1 Official brand authority

The authoritative BecaTech+ brand reference is:

`resources/design-reference/becatech-brand-guidelines.md`

which summarizes the official live manual:

`https://velezreyes.github.io/notion-content/becatech/becatech-brandbook.html`

The official manual governs:

- BecaTech+ brand identity;
- official palette;
- typography;
- BecaTech+ logo;
- logo treatment;
- core visual language;
- modular brand principles;
- brand communication conventions.

---

## 2.2 Application design authority

The current dashboard-specific UI reference remains:

`resources/design-reference/MVP_Dashboard AUGUST 4.html`

with implementation mapping documented in:

`docs/prototype-comparison.md`

The August reference continues to guide:

- dashboard information architecture;
- component structure;
- application layouts;
- interaction patterns;
- data-presentation patterns;

except where this specification deliberately changes the implemented visual system to align it with the official brand.

---

## 2.3 Product and domain authority

Neither the brand manual nor the dashboard mockup may override:

- production data;
- metric definitions;
- denominators;
- canonical scholar identity;
- risk definitions;
- authoritative risk source;
- spreadsheet mappings;
- query behavior;
- authorization;
- route behavior;
- domain calculations.

Visual alignment must adapt to product behavior, not redefine it.

---

# 3. Current State

A repository audit against the official BecaTech+ brand manual found that the application already has a strong brand foundation.

## 3.1 Already aligned

The following core brand colors are already implemented exactly in `src/app/globals.css`:

- Cream `#EFEFE4`
- Black `#000000`

Yellow:
- Light `#F7FF66`
- Base `#F3FF00`
- Dark `#C9D400`

Green:
- Light `#6FE0A7`
- Base `#27CF77`
- Dark `#1A9054`

Purple:
- Light `#C97AFF`
- Base `#A62BFF`
- Dark `#6F15C4`

Instrument Sans is already loaded through `next/font/google` and used as the primary body/UI face.

The existing dark sidebar, yellow active navigation treatment, purple accent language, `DarkCallout`, and black `ExecTable` headers already express the BecaTech+ brand strongly.

These successful patterns must be preserved unless a specific requirement below changes them.

---

## 3.2 Verified gaps

The audit identified the following genuine gaps.

### Logo

The application has no official BecaTech+ logo asset.

The current sidebar uses a hand-built purple square containing:

`B+`

The login screen represents VélezReyes+ using the plain-text string:

`ver+`

These are not approved logo assets and must eventually be replaced by official brand files.

---

### Display typography

The application currently maps display typography to:

`Georgia, "Times New Roman", serif`

The official BecaTech+ display face is:

`BookmanJF Pro`

BookmanJF Pro is not currently loaded by the application.

---

### Accessibility

Several uses of official accent colors as small text do not meet accessible contrast requirements.

Examples found during the audit include:

- base green on white;
- base green on mint;
- white on base green;
- base purple on cream at small sizes;
- base purple on lavender at small sizes.

The official green palette contains no tone sufficiently dark for all small-text use cases on light backgrounds.

The application also contains interactive controls that remove the default focus outline without supplying an adequate replacement.

Brand implementation must therefore include an application-specific accessibility layer.

---

### Color-system fragmentation

The application contains:

- official brand tokens;
- application-specific surface colors;
- stock Tailwind semantic colors;
- hardcoded chart colors;
- duplicated risk-color constants;
- unused/dead risk color definitions.

These need rationalization without forcing all functional colors into the marketing palette.

---

### Product-name inconsistency

The official identity uses:

`BecaTech+`

The application and historical documentation also contain:

`Beca Tech+`

User-facing brand surfaces should converge on the official spelling.

Internal historical references do not need mechanical renaming where no user-facing value is gained.

---

# 4. Goals

SPEC-005 must deliver the following outcomes.

1. Use the official BecaTech+ identity consistently on user-facing product surfaces.
2. Replace unofficial logo recreations with approved assets.
3. Preserve Instrument Sans as the application UI/body typeface.
4. Prepare and, if legally permitted, implement BookmanJF Pro for appropriate display typography.
5. Remove unsupported/synthesized `font-extrabold` usage.
6. Establish accessible application-specific rules for using brand colors.
7. Provide visible keyboard focus states on interactive controls.
8. Rationalize design tokens and remove provably dead duplicate color systems.
9. Preserve functional semantic colors when brand colors would reduce comprehension.
10. Refine charts and risk visualization only after SPEC-004 no longer owns the affected visualization surfaces.
11. Preserve functional scholar profile photography in color.
12. Standardize new and modified user-facing branding to `BecaTech+`.
13. Update design-system documentation so future UI changes use the same brand/application/accessibility rules.

---

# 5. Non-Goals

This specification does **not** authorize:

- redesigning dashboard information architecture;
- changing page routes;
- changing navigation permissions;
- changing authentication;
- changing authorization;
- changing scholar-level access;
- changing canonical scholar identity;
- changing spreadsheet ingestion;
- changing database schema;
- changing metric definitions;
- changing denominators;
- changing program risk classifications;
- deriving risk differently;
- changing risk levels;
- modifying source spreadsheet contracts;
- converting the dashboard to a marketing-site layout;
- mechanically forcing all spacing onto a 48px grid;
- mechanically replacing all radii with 2–3px;
- forcing all charts into yellow/green/purple;
- forcing semantic alerts into brand colors when that harms comprehension;
- converting functional scholar profile photos to black and white;
- placing the VélezReyes+ parent logo on every dashboard screen;
- committing or serving BookmanJF Pro without licensing confirmation;
- changing visualization work still governed by active SPEC-004 before that dependency is cleared.

---

# 6. Product and Design Decisions

The following decisions are authoritative for implementation.

---

## D1 — Official product name

**Decision:** User-facing product branding must use:

`BecaTech+`

New or modified visible product copy must use this spelling.

### Includes

- login branding;
- sidebar branding;
- metadata where appropriate;
- new UI documentation;
- exported/public communication surfaces added in the future.

### Does not require

- renaming route folders;
- renaming historical commits;
- rewriting completed specs solely for spelling;
- changing technical identifiers without product value.

---

## D2 — Instrument Sans remains the primary application typeface

**Decision:** Instrument Sans remains the standard face for:

- body text;
- navigation;
- controls;
- labels;
- table content;
- badges;
- filters;
- form elements;
- chart labels;
- most KPI supporting text.

The current `next/font/google` integration should be preserved.

### Weight rule

Unsupported `font-extrabold` / 800 usage must be removed.

Implementation must use weights actually available through the loaded Instrument Sans font.

Use of supported weight 700 is permitted as an **application-specific adaptation** when required for product hierarchy.

The brand manual's listed 300–600 examples are not interpreted as a prohibition on supported 700 application usage unless the brand authority explicitly clarifies otherwise.

The application must not rely on synthesized/faux 800 weight.

---

## D3 — BookmanJF Pro is display typography, not a universal heading font

**Decision:** BookmanJF Pro is the preferred brand display face for deliberately prominent display content.

Initial intended scope:

- `PageHeader` primary title;
- large `SectionTitle`;
- `HeroStat` primary display value where layout permits.

Other uses require component-level review.

In particular:

- avatar initials must remain UI typography and must not use Bookman merely because they are currently `font-display`;
- scholar/person names should not automatically become display typography.

### Licensing gate

BookmanJF Pro must **not** be committed, bundled, or served by the application until there is explicit confirmation that the available license permits web embedding/distribution for this product.

Until that decision is resolved:

- keep the existing display fallback;
- do not download or commit the TTF;
- do not claim typography alignment is complete.

### ADR trigger

If the decision is to self-host BookmanJF Pro, create an ADR covering:

- permitted distribution;
- repository storage;
- web serving;
- loading mechanism;
- fallback behavior;
- deployment implications.

If Bookman is not self-hosted, no ADR is required solely for retaining a fallback.

---

## D4 — Official logo assets only

**Decision:** Do not reconstruct BecaTech+ or VélezReyes+ marks with text, CSS shapes, or improvised graphics.

Approved logo files must come from the official brand source.

### BecaTech+ application logo

Replace the sidebar `B+` recreation with the approved BecaTech+ logo.

For the dark sidebar, use the approved variant intended for dark backgrounds.

Respect:

- official proportions;
- minimum `2X` clear space;
- minimum contrast;
- no distortion;
- no arbitrary recoloring;
- no shadows;
- no outlines;
- no rotation;
- no skew.

Official assets should live in a clearly scoped path such as:

`public/brand/`

when implementation begins.

---

## D5 — VélezReyes+ parent-brand placement

**Decision:** The VélezReyes+ logo should not automatically be placed in the persistent dashboard shell.

Use the official parent mark on:

- the login/authentication brand surface;
- exported communication pieces where applicable;
- future public BecaTech+ communication surfaces.

Do **not** add the VélezReyes+ logo to the persistent sidebar or every authenticated dashboard screen without a separate explicit brand/product decision.

The existing plain-text `ver+` login recreation should be replaced with the official mark when official assets are introduced.

---

## D6 — Brand palette and accessible application colors are separate layers

**Decision:** Never alter the official brand token values to solve an application accessibility problem.

The official brand colors remain exact.

If a brand tone cannot meet required contrast in a functional UI context, the application must adapt the usage.

### Purple

For small text on light/tinted surfaces, use an accessible darker purple such as the official `purple-dark` where appropriate rather than base purple.

### Green

The official green tones do not provide a sufficiently dark option for every small-text-on-light-background use case.

Therefore:

- base green should primarily be used for fills, indicators, graphical marks, larger elements, or contexts with adequate contrast;
- semantic textual meaning must not depend on inaccessible green text;
- when small positive/status text requires a green-like semantic treatment, the design system may define an application-specific accessible semantic token outside the official brand palette.

Any such token must:

- have a functional/semantic role;
- be clearly documented as application-specific;
- not be misrepresented as an official BecaTech+ brand color.

### Prohibited

Do not knowingly accept sub-AA small text merely to reproduce a brand hex literally.

---

## D7 — Accessibility takes precedence over literal brand reproduction

Brand alignment must preserve or improve:

- text contrast;
- control contrast;
- keyboard focus;
- color-independent meaning;
- chart distinguishability;
- dense-table readability.

Interactive controls must have clearly visible keyboard focus states.

Removing the native outline without providing an adequate replacement is not acceptable.

The brand implementation must include a consistent focus treatment for relevant controls, including current known cases such as filter/search controls.

Brand colors may be adapted in functional contexts when literal use would make the application less accessible.

---

## D8 — The two-accent rule is contextual, not page-global

The official brand manual recommends a maximum of two accent colors per composition.

For this application, apply that principle primarily to **decorative brand expression**, including:

- headers;
- hero treatments;
- navigation;
- callouts;
- non-semantic decoration;
- decorative card accents;
- empty states;
- branded CTAs.

Do not treat an entire analytics page as one marketing composition.

Functional exceptions include:

- charts;
- categorical data visualization;
- risk levels;
- status systems;
- errors/warnings;
- accessibility states.

The application should remain visually disciplined without making data harder to distinguish.

---

## D9 — Brand radius and 48px grid are principles, not literal application scales

The brand manual references:

- 48px modular grid;
- 2–3px radius;
- 90px gradient blur.

These describe the visual language of brand compositions.

They must not be mechanically mapped onto all product components.

### Radius

Existing application components may retain larger radii where they improve:

- grouping;
- touch target clarity;
- badge semantics;
- card hierarchy;
- interaction affordance.

Pills may remain rounded/full.

Do not globally replace the application's radius scale.

### 48px grid

Use the modular-grid concept only to inform:

- macro page rhythm;
- major section spacing;
- structural alignment.

Do not convert the Tailwind spacing system to 48px increments.

---

## D10 — Gradients are an application adaptation

The brand manual treats gradients as subtle accent devices.

The current dashboard uses gradients more structurally, particularly in `HeroStat`.

This is an application-specific adaptation inherited from the dashboard design reference.

Do not automatically remove existing gradients.

During implementation, each structural gradient must be classified as:

- retain;
- simplify;
- reduce prominence;
- replace.

The decision must consider:

- readability;
- hierarchy;
- recognizability;
- consistency with surrounding components.

Gradient changes are visual-only and must not affect data behavior.

---

## D11 — Semantic status colors may extend beyond the brand palette

Risk, warning, validation, error, success, and categorical colors have functional meaning.

The BecaTech+ brand palette does not replace a semantic UI color system.

Existing stock semantic colors may remain where they provide:

- clearer severity meaning;
- stronger accessibility;
- familiar product conventions.

However, arbitrary stock colors with no semantic justification should be replaced with a deliberate design-system token or documented categorical palette.

The final design system must distinguish:

1. brand colors;
2. product semantic colors;
3. categorical/chart colors.

---

## D12 — Risk semantics are not the brand spectrum

The brand spectrum:

`yellow → green → purple`

is a brand-expression construct.

It is **not** a risk-severity taxonomy.

Do not force risk levels to follow that sequence.

### Risk source of truth

The existing authoritative program risk semantics remain unchanged.

This specification must not alter:

- risk definitions;
- risk level order;
- stored risk values;
- global-risk authority;
- risk calculations;
- risk denominators.

### `RiskBadge`

The compact semantic badge system may retain its conventional severity ramp when it provides clearer semantic comprehension and accessibility.

### Visual risk scale

The heatmap/donut risk visualization may be refined if necessary so adjacent levels are visually distinguishable.

Any revised scale must:

- preserve the five existing risk levels;
- provide clear differentiation between adjacent levels;
- preserve labels or another non-color cue;
- not imply that brand hue order defines risk severity;
- avoid misleading visual equivalence.

This refinement is a presentation decision only.

---

## D13 — Functional scholar photography remains in color

**Decision:** Scholar identity/profile photos remain in color inside the authenticated working application.

The manual's black-and-white photography rule applies to brand/editorial communication photography, not automatically to functional identity images used to recognize individual scholars.

Black-and-white treatment should be considered for:

- exported communication pieces;
- editorial/public storytelling surfaces;
- future brand campaigns.

Do not reprocess existing scholar profile photos as part of SPEC-005.

---

## D14 — Existing application-specific colors are not automatically defects

Tokens such as:

- `--ink`;
- `--muted`;
- `--card`;
- `--border`;
- `--lavender`;
- `--mint`;
- `--chip-cream`;
- `--track`;
- `--purple-deep`;
- `--surface-dark-soft`;

exist because an interactive data product needs roles the official brand palette does not define.

Preserve them unless the implementation audit for a specific component identifies a concrete reason to change them.

Brand alignment must not collapse the application palette into only the official marketing colors.

---

# 7. Design-System Cleanup Requirements

SPEC-005 must reconcile the implemented design system with the new source-of-truth model.

## 7.1 Source-of-truth comments

Update stale comments in at least:

- `src/app/globals.css`;
- `src/components/ui.tsx`;
- `src/app/layout.tsx`;

so they distinguish:

- official brand authority;
- application-specific design-reference authority;
- current implementation tokens.

The August mockup must no longer be described as the sole authority for brand identity.

---

## 7.2 Risk-token duplication

The repository currently defines segmented risk values both as CSS tokens and as TypeScript constants.

The actual application consumers use the TypeScript representation rather than directly consuming the CSS `--risk-*` tokens.

Implementation must establish one clear authoritative visual representation.

Do not retain dead duplicate systems merely because documentation currently mentions them.

Before deleting any constant or token:

- prove it has no runtime consumers;
- update tests/docs;
- preserve current behavior unless a later requirement explicitly changes the visual scale.

`RISK_LEVEL_HEX` may be removed if repository-wide verification confirms it remains unused.

---

## 7.3 Hardcoded color cleanup

Hardcoded colors that simply duplicate named design tokens should be replaced by the appropriate design-system mechanism where technically practical.

Do not mechanically replace:

- dynamic Recharts colors;
- semantic colors;
- categorical series colors;

without first assigning them a clear role.

The objective is a comprehensible color architecture, not zero string literals at any cost.

---

# 8. Logo and Asset Requirements

When official assets are introduced:

1. use files downloaded from the official brand source;
2. preserve original vector quality where SVG is available;
3. store assets in an explicit brand asset location;
4. use semantic filenames;
5. do not alter the mark geometry;
6. do not redraw the logo from screenshots;
7. maintain clear-space requirements;
8. verify both desktop and mobile shell behavior.

No font binaries may be introduced under the same asset task unless the Bookman licensing decision has already been resolved.

Logo implementation and font implementation are separate decisions.

---

# 9. Typography Requirements

## 9.1 Body and controls

Instrument Sans remains the default application face.

Audit and normalize unsupported weight usage.

`font-extrabold` must not depend on synthesized weight.

---

## 9.2 Display typography

When Bookman becomes legally and technically available, use it only where the component's role is genuinely display-oriented.

Initial target components:

- page title;
- major numbered section heading;
- prominent hero statistic.

Each migration must be visually checked for:

- text wrapping;
- width changes;
- line-height changes;
- baseline alignment;
- mobile overflow;
- hero/card layout regression.

---

# 10. Focus and Interaction Requirements

Every interactive control touched by this work must retain or gain a visible keyboard focus state.

At minimum audit:

- `FilterSelect`;
- scholar search;
- buttons;
- navigation links;
- interactive filter chips;
- form controls introduced or restyled by SPEC-005.

Focus must not rely solely on color changes that are too subtle to perceive.

Hover styling is not a substitute for keyboard focus.

No control may use `focus:outline-none` without an adequate replacement focus indicator.

---

# 11. Chart and Visualization Requirements

This section is **dependency-gated by SPEC-004** for any surface SPEC-004 currently owns.

Do not create competing chart diffs while SPEC-004 remains active.

After SPEC-004 is completed:

## 11.1 Categorical charts

Replace arbitrary stock/off-brand series colors when they have no functional justification.

The categorical palette may derive from the BecaTech+ identity but must prioritize:

- differentiation;
- readable legends;
- distinguishable adjacent series;
- accessibility;
- stable meaning.

Do not force every series into only three colors when the chart needs more categories.

---

## 11.2 Risk visualization

Refine the presentation only if the existing segmented scale does not distinguish levels sufficiently.

The implementation must preserve:

- risk order;
- labels;
- risk data;
- risk source of truth;
- metric behavior.

Use non-color cues where appropriate.

Do not derive semantic severity from the BecaTech+ brand spectrum.

---

## 11.3 Chart tokens

Chart axis, grid, default series, semantic series, and categorical series colors should use named roles where practical.

The design system should clearly document which colors are:

- brand;
- semantic;
- categorical;
- neutral.

---

# 12. Cards, Containers, and Controls

Do not globally redesign existing cards.

For each shared primitive touched by this work, preserve:

- hierarchy;
- density;
- semantics;
- responsive behavior.

Audit includes:

- `Card`;
- `KpiCard`;
- `DarkCallout`;
- `HeroStat`;
- `StatChip`;
- `ActivityChip`;
- `StatusBadge`;
- `ProxyBadge`;
- `TypeBadge`;
- generic `Badge`;
- filters;
- tables.

Changes must be made at reusable primitive/token level where possible rather than independently restyling every page.

---

# 13. Tables

`DataTable` and `ExecTable` have separate purposes and must remain separate unless an independent requirement justifies architectural consolidation.

Brand work may change:

- typography;
- accessible color treatment;
- headers;
- summary-row foreground/background combinations;
- focus/interactive states where relevant.

Brand work must not change:

- table data;
- row meaning;
- aggregation;
- filtering;
- sort semantics;
- authorization.

Summary rows using light foreground text over brand green must be corrected if contrast is insufficient.

---

# 14. Responsive Behavior

Every visual implementation phase must preserve:

- mobile drawer behavior;
- sidebar layout;
- sticky/global filter behavior;
- table overflow handling;
- card grids;
- chart responsiveness;
- scholar profile readability.

Brand alignment is not complete until affected components are verified at multiple viewport sizes.

---

# 15. Authorization / Security

SPEC-005 introduces no authorization changes.

All existing:

- `requirePermission()` checks;
- scholar-level access scoping;
- server-side query filters;
- sensitive-data boundaries;
- route guards;

must remain unchanged.

Visual hiding is not an authorization mechanism.

No visual refactor may move sensitive-data decisions into client-only presentation code.

---

# 16. Data Considerations

SPEC-005 introduces no new data source and no database change.

There must be:

- no Prisma migration;
- no schema change;
- no backfill;
- no spreadsheet contract change;
- no ingestion change.

Risk visualization changes must preserve underlying risk values exactly.

Charts must continue to receive the same underlying data unless a different owning specification explicitly changes those data semantics.

---

# 17. Implementation Phases

Implementation should be divided into independently reviewable tasks.

---

## Phase 1 — Brand foundations and design-system cleanup

### Goal

Establish a coherent technical foundation without changing major page visuals.

### Scope

- correct stale source-of-truth comments;
- normalize user-facing `BecaTech+` naming when files are touched;
- prove and remove dead design/risk constants;
- reconcile design-system documentation with actual implementation;
- remove unsupported Instrument Sans 800/extrabold usage;
- define brand vs semantic vs categorical token roles;
- retain the existing display fallback pending Bookman licensing.

### Dependency

None on SPEC-004.

### Bookman dependency

Do not block unrelated Phase 1 cleanup on Bookman licensing.

### Risk

Low.

---

## Phase 2 — Accessibility and interaction remediation

### Goal

Make current brand usage accessible before adding more brand expression.

### Scope

- correct inaccessible small purple text with appropriate darker treatment;
- remove inaccessible base-green text usage;
- introduce an application-specific accessible positive-text token if required;
- preserve official brand tokens unchanged;
- add consistent `focus-visible` treatment;
- remediate touched badges/chips/filter/search states;
- correct inaccessible foreground/background combinations such as white text on brand green where present.

### Dependency

Phase 1 token decisions.

### Risk

Medium.

### Browser QA

Mandatory.

---

## Phase 3 — Official logos and application shell

### Goal

Replace unofficial text/logo recreations with approved assets.

### Scope

- obtain official BecaTech+ assets;
- add approved brand assets;
- replace sidebar `B+`;
- replace login `ver+` with the official parent mark;
- use official `BecaTech+` spelling;
- preserve existing navigation and authentication behavior.

### Dependency

Official assets available.

### Risk

Low.

### Browser QA

Mandatory.

---

## Phase 4 — Display typography

### Goal

Implement BookmanJF Pro where appropriate.

### Dependency

Explicit licensing/web-distribution approval.

If self-hosting is approved, the ADR must be accepted before implementation.

### Scope

Initial targets:

- `PageHeader`;
- large `SectionTitle`;
- `HeroStat`.

Do not automatically migrate avatar initials or all names.

### Risk

Medium.

### Browser QA

Mandatory at multiple viewport sizes.

---

## Phase 5 — Visualization and risk color alignment

### Goal

Rationalize chart and visual-risk colors while preserving data semantics.

### Hard dependency

SPEC-004 must no longer be active on the affected visualization surfaces.

### Scope

- deliberate categorical palette;
- remove arbitrary stock/off-brand series colors;
- consolidate risk color source;
- refine visual risk separation if necessary;
- preserve conventional semantic risk badges where appropriate;
- update chart token architecture;
- correct relevant documentation.

### Risk

High relative to other SPEC-005 phases because color changes affect interpretation.

### Browser QA

Mandatory.

### Data-semantics review

Mandatory to confirm only presentation changed.

---

## Phase 6 — Gradient and application-level polish

### Goal

Review remaining visual adaptations after foundations are stable.

### Scope

- `HeroStat` gradient treatment;
- decorative accent discipline;
- card-level inconsistencies;
- remaining hardcoded decorative colors;
- macro page rhythm where useful;
- consistent official product naming.

Do not mechanically apply the marketing grid/radius rules.

### Risk

Low to Medium.

---

## Phase 7 — Final responsive and accessibility QA

### Goal

Validate the system as a whole.

Perform a real browser-based QA pass across major implemented routes.

At minimum:

- Home;
- Early Support;
- Growth & Development;
- Contact Prioritization;
- Find a Scholar;
- individual Scholar Profile;
- Program Ecosystem;
- login;
- admin surfaces affected by shared primitives.

Include mobile, tablet/intermediate, and desktop viewport coverage.

---

# 18. Acceptance Criteria

SPEC-005 is complete when all applicable criteria below are satisfied.

## Brand identity

- Official BecaTech+ logo assets replace hand-built logo recreations.
- Login no longer uses plain-text `ver+` as the VélezReyes+ mark.
- Modified user-facing brand surfaces use `BecaTech+`.
- Logo proportions and clear space follow the official manual.
- No unofficial logo variant is created.

## Typography

- Instrument Sans remains the primary UI/body font.
- Unsupported/synthesized 800 usage has been removed.
- BookmanJF Pro is either:
  - implemented under an explicitly permitted licensing/distribution model; or
  - explicitly deferred with the fallback retained and the unresolved licensing decision documented.
- Display font changes do not introduce unresolved wrapping/overflow defects.

## Accessibility

- No newly modified small-text brand usage knowingly relies on an insufficient-contrast pair.
- Base green is not used for inaccessible small text on light backgrounds.
- Brand tokens themselves remain unchanged.
- Relevant controls have visible keyboard focus states.
- Meaning is not conveyed by color alone where another cue is required.
- Updated visualizations remain distinguishable.

## Color system

- Brand, semantic, neutral, and categorical color roles are documented.
- Provably dead duplicate risk/color definitions are removed or consolidated.
- Hardcoded colors that merely duplicate named tokens are rationalized where practical.
- Functional semantic colors are not removed merely because they are outside the brand palette.

## Risk

- Program risk definitions are unchanged.
- Risk source of truth is unchanged.
- Risk values and level order are unchanged.
- Any changed risk visualization preserves labels/non-color cues.
- Brand spectrum order is not used as a severity model.

## Photography

- In-product scholar identity/profile photos remain in color.
- No batch photo reprocessing is introduced.

## Application behavior

- Routes are unchanged.
- Filters preserve current behavior.
- Authorization remains server-side.
- Navigation permissions remain unchanged.
- No metric semantics change.
- No data-source mapping changes.
- No database migration is introduced.

## Quality

- Relevant unit tests pass.
- Relevant integration tests pass when shared behavior is affected.
- lint passes.
- TypeScript validation passes.
- build passes.
- `npm run dashboard:check` passes for phases affecting dashboard visualizations.
- `git diff --check` passes.
- Browser QA is completed for phases marked mandatory.
- Known visual limitations are documented rather than silently accepted.

---

# 19. Testing Requirements

Testing must be proportional to each implementation phase.

## Foundation/token phases

At minimum:

- lint;
- TypeScript;
- relevant unit tests;
- build;
- `git diff --check`.

## Accessibility/control phases

Additionally verify:

- keyboard focus;
- focus visibility;
- text contrast;
- selected/hover/focus states;
- representative badges/chips;
- mobile interaction.

## Logo/typography phases

Browser QA must verify:

- desktop;
- intermediate width;
- mobile;
- sidebar/drawer;
- login;
- affected page headers;
- `HeroStat` wrapping.

## Chart/risk phase

Additionally:

- verify identical underlying data before/after visual change;
- run dashboard query checks;
- verify legends;
- verify categorical series distinction;
- verify risk-level distinction;
- verify missing/null values are unchanged;
- verify filters still produce the same data.

Do not claim visual QA based only on static code inspection.

---

# 20. Documentation Impact

Implementation of SPEC-005 must update as appropriate:

- `docs/DESIGN_SYSTEM.md`;
- `docs/prototype-comparison.md` if application-reference mappings change;
- `resources/design-reference/becatech-brand-guidelines.md` only if application guidance requires clarification;
- relevant comments in `src/app/globals.css`;
- relevant comments in shared UI source files;
- this specification as decisions move from planned to implemented.

If BookmanJF Pro is self-hosted, add the required ADR.

Do not rewrite unrelated architecture documentation.

---

# 21. Dependency on SPEC-004

SPEC-004 remains active at the time this specification is written.

SPEC-005 work may proceed on independent areas such as:

- design-system cleanup;
- accessibility;
- focus states;
- branding assets;
- sidebar/logo work;
- login branding;
- typography decisions.

SPEC-005 must **not** introduce competing visualization changes on Home, Early Support, or Program Ecosystem while SPEC-004 still owns those surfaces.

Phase 5 begins only after:

1. SPEC-004's relevant implementation is complete;
2. its production-recovery/validation state is resolved sufficiently for the affected visualization behavior to be considered stable;
3. `main` is re-audited before the brand visualization change begins.

This dependency avoids styling against moving visualization code.

---

# 22. Blocked / Deferred Items

## BookmanJF Pro

**Status:** BLOCKED ON LICENSING CONFIRMATION.

Required decision:

> Does the supplied BookmanJF Pro license permit this application to self-host/embed the font and serve it through the deployed web product?

Until confirmed:

- no TTF in the repository;
- no production font hosting;
- fallback remains.

This blocker does not prevent other SPEC-005 phases.

---

## VélezReyes+ persistent shell placement

**Decision for this spec:** do not add it to the persistent authenticated shell.

If stakeholders later require persistent co-branding, treat that as a specific visual/product change rather than silently expanding this spec.

---

## Export surfaces

The parent-brand requirement applies to communication/export surfaces, but SPEC-005 does not require creation of an export system that does not currently exist.

Any future export feature must consult the brand manual.

---

# 23. Explicit Decisions Preserved for Future Work

For future contributors and AI agents:

1. Official green is not an acceptable small-text color merely because it is the official green.
2. Application-specific accessible colors are permitted when clearly documented as semantic/product colors.
3. Brand spectrum order does not define risk severity.
4. Risk semantics outrank decorative brand conformity.
5. The two-accent rule governs decorative expression, not all data colors on an analytics screen.
6. Scholar identity photos stay in color inside the working product.
7. The 48px grid is a macro-composition principle, not the application's spacing unit.
8. 2–3px brand radius is not a mandate to flatten all cards/pills.
9. Bookman is display typography, not a universal serif replacement.
10. VélezReyes+ is required on appropriate communication surfaces but not automatically in persistent authenticated chrome.
11. `BecaTech+` is the canonical user-facing brand spelling.
12. Brand alignment must never silently redefine data, risk, access, or application behavior.

---

# 24. Completion Definition

SPEC-005 may move to `completed/` when:

- all non-deferred implementation phases are merged;
- SPEC-004 dependency-sensitive visualization work has either been completed or explicitly documented as deferred to a separately owned follow-up;
- accessibility requirements are validated;
- official logo treatment is implemented;
- typography state is explicitly resolved, including any Bookman deferral;
- final browser QA is completed;
- relevant documentation matches implemented reality;
- no unresolved regression affecting data readability, navigation, authorization, or responsive behavior remains.

A brand-aligned dashboard is not defined as one that reproduces the manual literally.

It is defined as one that consistently expresses the BecaTech+ identity through an accessible, coherent, and trustworthy application design.