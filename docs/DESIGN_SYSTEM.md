# Design System

## Source

`design-reference/MVP_Dashboard AUGUST 4.html` is the current source-of-truth mockup — per
`globals.css`'s own header comment ("Exact hex values come from the design reference...") and
`docs/prototype-comparison.md`, which tracks how each design element maps onto the real app. It
supersedes `design-reference/MVP_Dashboard JULY 2.html`, kept only for history. Neither file is
served by the app — only its interface ideas are adapted; see `docs/prototype-comparison.md` for
what was implemented, adapted, deferred, or rejected and why.

## Token Location

All design tokens live in `src/app/globals.css`, as raw hex under `:root`, mapped onto Tailwind
4's `--color-*` namespace via a `@theme inline` block. There is no separate `tailwind.config.*`
file — Tailwind 4 is CSS-configured.

## Named Tokens

Brand palette: `--cream` (page background), `--purple` (primary accent), `--yellow` (accent on
dark surfaces), `--green` (positive deltas), `--surface-dark` (sidebar, dark callouts,
exec-table header), `--ink` (primary text), `--muted` (secondary text), `--card` (card surface),
`--border` (hairline borders).

Light/dark stops per accent (fixed stops, not a numeric scale): `--yellow-light`/`-dark`,
`--green-light`/`-dark`, `--purple-light`/`-dark`, plus two one-off stops the design uses as bare
hex: `--purple-deep` (the Peru summary row in exec tables) and `--surface-dark-soft` (the warm
start of the black gradient — deliberately not `--ink`, which is a text color).

`--black` is a raw alias for `--surface-dark` (kept so markup transcribed directly from the
design reference keeps working) and is deliberately **not** exported to `@theme` — Tailwind
already ships `--color-black`.

Supporting tints: `--lavender` (PROXY pill / activity chip / question chip background), `--mint`
(status-badge background), `--chip-cream` (stat-chip background), `--track` (progress-bar track
background).

Segmented risk palette: `--risk-none`, `--risk-low`, `--risk-medium`, `--risk-high`,
`--risk-critical` — the design's own re-coloring of the 0–4 risk scale onto brand hues, kept
deliberately separate from `--green-light` (per the code comment: *"`--risk-low` is a scale
position, not an accent"*).

Display face: `--font-display-stack` — falls back to `Georgia, "Times New Roman", serif` (the
licensed brand face, BookmanJF Pro, is not loaded; neither the app nor the design reference loads
it, so they match).

Read `src/app/globals.css` directly for exact current hex values rather than copying them here —
this document tracks names and roles, not numbers that can drift.

## Rule Against Hardcoded Colors

Do not hardcode hex values in components. Add or reuse a token in `globals.css` instead. This
convention is stated in project documentation (this file and, historically, the README) rather
than enforced by a linter — treat it as a hard rule when reviewing or writing UI code.

## Reusable Primitives

`src/components/ui.tsx` — `PageHeader`, `SectionTitle`, `Card`, `KpiCard`, `DarkCallout`,
`StatChip`, `ActivityChip`, `StatusBadge`, `ProxyBadge`, `RiskBadge`, `AccessDenied`, `Badge`,
`HeroStat`, `FilterChipRow`, `CountryGroupTitle`, `TypeBadge`. Table primitives:
`src/components/DataTable.tsx` (generic `Column<T>[]` rows) and `src/components/ExecTable.tsx`
(the design's black-header, right-aligned, colored-summary-row matrix) — kept deliberately
separate; each file's own header comment explains why forcing one shape into the other would
pollute callers.

## RiskBadge vs. RiskHeatmapTable / Donut

Two different color systems for risk, by design, not by accident (`globals.css`'s own comment on
the risk-token block states this explicitly):

- **`RiskBadge`** (`src/components/ui.tsx`) — a compact inline pill for dense tables. Uses
  `RISK_LEVEL_CLASS` (`src/lib/labels.ts`), a Tailwind-utility green→amber→red scale
  (`bg-emerald-100` → `bg-red-100`), not the `--risk-*` CSS tokens.
- **`RiskHeatmapTable`** (`src/components/RiskHeatmapTable.tsx`) and **`Donut`**
  (inside `src/components/charts.tsx`) — read the `--risk-*` segmented brand-hue scale directly,
  for the Monthly Detail heatmap and donut visualizations.

There is no `RiskBar` component — if you find a reference to one in an older document, it has
been replaced by `RiskHeatmapTable`.
