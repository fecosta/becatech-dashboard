# SPEC-001 — Scholar Profile Split

Status: Completed (PR #5, merged to `main` as `3845ae8`, 2026-09-01)

## Goal

Separate the former combined Scholar Profile experience into dedicated screens so that users can
work through scholar lists without losing list context, and individual scholar profiles have
directly addressable URLs.

## Context

The Scholar Profile section previously mixed search/list behavior and profile rendering on a
single route (`/dashboard/scholars`): the individual profile appeared *in place of* the search
results table whenever a search happened to match exactly one scholar, and the "real" profile
route (`/dashboard/scholars/[scholarId]`) was a redirect stub that bounced into a `?q=` search
rather than rendering anything itself. Clicking a scholar rewrote the current page's URL, so
there was no way to open a scholar's profile without losing your place in the list you were
working through.

The implemented structure separates:
1. Contact Prioritisation
2. Find a Scholar
3. Individual Scholar Profile

The sidebar retains one "Scholar Profile" entry — `VIEW_ORDER`
(`src/lib/dashboard/views.ts`) still lists five primary views, unchanged. The two list screens
are reached through a small tab row (`src/components/ScholarSectionTabs.tsx`) rendered inside the
section.

## User Workflow

### Contact Prioritisation
Route: `/dashboard/scholars`

Users review scholars at medium risk or above, highest risk first, with contact details. This is
also `VIEW_ORDER`'s canonical href for the section, so the sidebar and the prev/next
`SectionNav` walk land here. Selecting a scholar opens the individual profile in a new browser
tab (`target="_blank"`), so the prioritisation list — and any applied filters — remains
untouched in the original tab.

### Find a Scholar
Route: `/dashboard/scholars/find`

Users search by name, ID, or university over the full scholar directory. Selecting a scholar
opens the profile in a new browser tab. An exact single search match remains a one-row result
list — it does **not** replace the screen with the profile; this screen has to survive the click.

### Scholar Profile
Route: `/dashboard/scholars/[scholarId]`

The profile is directly addressable by the canonical `scholarId`
(`docs/adr/001-canonical-scholar-identifier.md`). The page:
- enforces the section permission (`requirePermission(Permission.VIEW_SCHOLAR_TRACKING)`);
- enforces scholar-level access (`canAccessScholar()`) before rendering;
- survives a refresh and works from a pasted URL — it fetches by `scholarId` from `params`, with
  no dependency on any state set by the list screens;
- renders `notFound()` (404) for an unknown `scholarId`.

`ScholarProfileView` (`src/components/ScholarProfileView.tsx`) is reused unchanged — it already
took `{ scholarId, user }` and already called `getScholarProfile()` / `notFound()` itself. There
is exactly one copy of the profile UI.

## Redirect Compatibility

`/dashboard/scholars?q=<term>` (the search term's former home, and the destination the old
`[scholarId]` redirect stub used to bounce to) redirects to
`/dashboard/scholars/find?q=<term>`, preserving any other filters present, so old bookmarks and
links keep working.

## Requirements

- preserve existing prioritisation ordering (`getContactPriority`, highest risk first);
- preserve applicable dashboard filters (country, cohort, university, status, risk) across all
  three screens and across the new-tab hop, via `preserveParams()`;
- preserve scholar access scoping (`scholarAccessWhere()`, `canAccessScholar()`) unchanged;
- use the canonical `scholarId`, no new identifier;
- open profiles from both list screens in a new tab (`target="_blank" rel="noopener noreferrer"`,
  real `<Link>`s, not JavaScript-only navigation);
- keep the sidebar information architecture unchanged (one "Scholar Profile" entry, five-view
  `VIEW_ORDER`);
- keep the section's list navigation/tabs (`ScholarSectionTabs`).

## Non-Goals

- changing scholar identity;
- changing risk calculation;
- changing contact data;
- redesigning the scholar profile UI itself;
- changing authorization roles or permissions.

## Authorization

Mentor restrictions and every other scholar-access rule remain enforced server-side, unchanged:
`requirePermission()` on each page, `canAccessScholar()` before rendering a profile,
`scholarAccessWhere()` inside both list queries. See `docs/SECURITY.md`.

## Acceptance Criteria

- Contact Prioritisation has its own route (`/dashboard/scholars`).
- Find a Scholar has its own route (`/dashboard/scholars/find`).
- Individual profiles have a direct route (`/dashboard/scholars/[scholarId]`).
- Profiles open in a new tab from both list screens.
- A search with exactly one result stays a one-row list, not an inline profile.
- The legacy `?q=` search URL redirects to Find a Scholar.
- Per-scholar authorization remains enforced on direct URL access.
- Existing applicable filters continue to work and carry across the new-tab hop.

## Testing

- `tests/nav-permissions.test.ts` — `VIEW_ORDER` and the sidebar/prev-next permission mapping
  are unchanged by this split (still five views).
- `tests/filters.test.ts` — pill-set assertions extended to cover all three scholar routes
  (`/dashboard/scholars`, `/dashboard/scholars/find`, `/dashboard/scholars/[scholarId]`).
- `tests/scholar-routes.test.ts` — new unit tests for the href-builder helpers
  (`src/lib/dashboard/scholar-routes.ts`) that both list screens use to link to a profile.

## Documentation Impact

`docs/PRODUCT.md`'s Scholar Profile section and `docs/ARCHITECTURE.md`'s route tree reflect the
three-route structure described here.
