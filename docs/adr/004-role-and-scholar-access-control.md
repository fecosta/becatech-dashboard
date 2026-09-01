# ADR-004 — Role and Scholar Access Control

Status: Accepted
Date: 2026-09-01 (documenting an already-established decision)

## Context

The dashboard serves six distinct program roles with different scopes of legitimate access —
from Finance (financial views only) to Mentor (scholar tracking, but only for their own assigned
scholars) to Analyst/Admin (everything, including data management). Scholar records include
personally identifiable and sensitive information, so access must be both section-scoped (which
views a role may open) and, for mentors, record-scoped (which individual scholars they may see).

## Decision

Two layers, both enforced server-side, never only in the UI:

1. **Role → permission.** `src/lib/auth/authorization.ts` defines `ROLE_PERMISSIONS`, a pure
   `Record<UserRole, Permission[]>` lookup (full table in `docs/SECURITY.md`). Every dashboard
   page and mutating API route calls `requirePermission()`
   (`src/lib/auth/guard.ts`) before rendering or acting.

2. **Scholar-level scoping for mentors.** `canAccessScholar(user, scholarId)` and
   `scholarAccessWhere(user)` restrict a `MENTOR` to `CurrentUser.assignedScholarIds`
   (sourced from `UserScholarAccess`); every other role with `VIEW_SCHOLAR_TRACKING` is
   unrestricted at this layer. `scholarAccessWhere()` is applied inside the query layer
   (`src/lib/dashboard/queries.ts`), not just checked before rendering — so a mentor's list and
   detail queries are scoped at the database-query level, not filtered after the fact.

**UI hiding is not authorization.** `src/app/dashboard/layout.tsx` filters which nav links are
shown and redirects on mount, but its own comment states this is a *"fast-path UX redirect
only"* — the real enforcement boundary is each page's own `requirePermission()`/
`requireScholarAccess()` call, because layouts do not re-render on client-side navigation between
sibling routes they wrap. A role change or a client-side navigation to a page a user shouldn't
see must be caught by that page's own guard, not inferred from what the sidebar happened to show.

## Consequences

- Every new dashboard page must call `requirePermission()` (and `canAccessScholar()`/
  `requireScholarAccess()` if it renders a single scholar) itself — it cannot rely on the layout
  or the sidebar for protection.
- Every new scholar-list or scholar-detail query must apply `scholarAccessWhere()` (or an
  equivalent explicit scope), not just trust that only authorized users reach the page.
- A mentor with zero scholar assignments sees zero scholars — never "everything" — by design of
  `scholarAccessWhere()`'s fallback.
- One page currently deviates from "every page guards itself": `admin/imports/new/page.tsx`, a
  client component protected only by nav-visibility plus the two API routes it calls being
  independently guarded. No data is exposed by this gap (documented in `docs/SECURITY.md`), but
  it is not the pattern to copy for a new page.
- Changing the role/permission table, the mentor-scoping model, or the layout-vs-page enforcement
  split requires a new ADR.

## Alternatives Considered

No repository evidence of an alternative authorization model (e.g. row-level security in
Postgres, a claims-based token model) having been implemented or documented — omitted rather than
invented.
