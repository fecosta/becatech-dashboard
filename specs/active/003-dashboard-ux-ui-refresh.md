# SPEC-003 — Dashboard UX/UI Refresh

Status: Active

## Goal

Update the Beca Tech dashboard interface to match `design-reference/MVP_Dashboard AUGUST 4.html`
while preserving production behavior, data integrity, routing, access control, and supported
metric semantics.

## Design Reference

`design-reference/MVP_Dashboard AUGUST 4.html`.

## Context — this is largely already done

The AUGUST 4 redesign shipped to production via PR #4 (2026-08-25), and the Scholar Profile split
into Contact Prioritization / Find a Scholar shipped via PR #5 (2026-09-01) — see
`docs/prototype-comparison.md` for the full design-vs-implementation audit and
`specs/completed/001-scholar-profile-split.md`. This spec's job is to close the specific,
verified gaps found when re-auditing against a fresh, detailed requirements pass — not to rebuild
the interface from scratch.

## Visible Navigation

Sidebar shows: Home, Early Support, Growth & Development, Scholar Profile, Program Ecosystem
(from `VIEW_ORDER`, `src/lib/dashboard/views.ts`), plus an "Admin" group (Data Imports, Data
Quality) for roles that can already open them — an explicit, deliberate product decision to keep
operational tooling reachable from the sidebar.

**Unit Economics and Selection Pipeline are hidden from the sidebar** (removed from the `NAV`
config in `src/app/dashboard/layout.tsx`) but remain fully implemented: same routes
(`/dashboard/unit-economics`, `/dashboard/selection-pipeline`), same `requirePermission()` guards,
same tests for the pages themselves. Only their sidebar entries were removed. `hidden != removed`.

## Early Support

Implements the required information hierarchy and graphs against real production data (numbered
1 / 2.1–2.6 / 3, `ExecTable`/`Donut`/`LineCard`/`ComboBarLineCard`) — see
`docs/prototype-comparison.md`'s Early Support table. The M1→M6 participation-vs-risk monthly trend
graph, previously deferred pending `RiskAssessment`'s period-identity fix, is now implemented in
section 2.3 (`getMonthlyParticipationRiskTrend`, scoped to one semester via ADR-008's `semester`
column) — see "Deferred" below for what it does *not* cover.

## Scholar Profile

Already split into Contact Prioritization (`/dashboard/scholars`), Find a Scholar
(`/dashboard/scholars/find`), and the individual profile (`/dashboard/scholars/[scholarId]`), all
opening the profile in a new tab (`target="_blank" rel="noopener noreferrer"`) — see
`specs/completed/001-scholar-profile-split.md`. This pass adds **National ID** and **Country** as
visible columns in Contact Prioritization (previously computed/used for routing but not shown).
`Scholar.scholarId` is confirmed, from real production data, to already be the scholar's national
identity number (e.g. `"1023524767"`) — not a synthetic program-assigned code; the seed data's
`BT-CO-001`-shaped ids are illustrative only, not a real production shape.

## Non-Goals

- database redesign;
- ingestion redesign (beyond what the ingestion-adapter work already changed);
- auth changes;
- permission redesign;
- deletion of hidden routes;
- invented metrics;
- hardcoded design-reference values;
- fixing the sensitive-notes permission gap noted below (documented, not in scope here);
- the M1→M6 trend graph or any `RiskAssessment` schema change (see ADR-008).

## Acceptance Criteria

- Sidebar shows exactly: Home, Early Support, Growth & Development, Scholar Profile, Program
  Ecosystem, Data Imports, Data Quality — never Unit Economics or Selection Pipeline.
- Unit Economics and Selection Pipeline remain reachable by direct URL, with their existing
  permission checks and tests unchanged.
- Contact Prioritization shows National ID and Country columns in addition to the existing
  Scholar/Email/Mobile/University/Cohort/Risk columns.
- All previously-passing tests continue to pass, with `tests/nav-permissions.test.ts` updated to
  assert the new (hidden) sidebar behavior for Unit Economics/Selection Pipeline specifically.

## Deferred

- **M1→M6 participation-vs-risk trend graph — now implemented** (Early Support, section 2.3), once
  `docs/adr/008-risk-period-identity.md` (Status: Accepted) closed the semester-collision defect
  that blocked it. The sheet's bare `MONTH` column remains unmapped/unclarified — unaffected by
  either change. Still out of scope: a global semester *rollup* view (e.g. comparing semesters
  side by side) and the Scholar Profile's semester-scoped risk history, which ADR-008 unblocked at
  the data layer but didn't build.
- **Sensitive-notes permission gap** (found during this audit, unrelated to the redesign):
  `VIEW_SENSITIVE_NOTES`/`canViewSensitiveNotes()` (`src/lib/auth/authorization.ts`) is defined and
  unit-tested in isolation but never actually called from any page or query — so `EXECUTIVE` (and
  any other role without `VIEW_SENSITIVE_NOTES`) can see scholar email/phone in Contact
  Prioritization and the individual profile, despite `docs/SECURITY.md` documenting that sensitive
  fields should be gated behind it. Documented here at the user's request; not fixed as part of
  this spec — it's a real authorization decision that deserves its own explicit review, not a side
  effect of a UI pass.
- **Growth & Development's section styling** doesn't use the numbered-executive-outline pattern
  the other four primary views use (it uses `FactStrip`/`BulletTrackGoal` instead) — a minor,
  pre-existing visual inconsistency noted during the audit, not treated as a required fix since the
  page's actual metrics (goal-vs-actual, `PENDING` handling for unsupported MAKERS/skills data)
  already match production data correctly.

## Documentation Impact

`docs/prototype-comparison.md` (fix a dangling cross-reference), `docs/PRODUCT.md` /
`docs/ARCHITECTURE.md` (reconcile "Career Readiness" → "Growth & Development" naming — the UI
label and `VIEW_ORDER` already say "Growth & Development"; only these two docs and the route
folder name still say "Career Readiness"), `docs/adr/008-risk-period-identity.md` (new).
