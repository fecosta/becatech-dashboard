# Security and Access Control

Architecture context: see [ARCHITECTURE.md](ARCHITECTURE.md). Decision records:
[adr/003-supabase-auth-and-app-user.md](adr/003-supabase-auth-and-app-user.md),
[adr/004-role-and-scholar-access-control.md](adr/004-role-and-scholar-access-control.md).

## Authentication

Supabase Auth handles Google sign-in. `src/proxy.ts` (Next.js 16's renamed middleware
convention) checks session *existence* only — it calls `supabase.auth.getUser()` (which
revalidates the JWT against the Supabase Auth server; it deliberately never trusts
`getSession()`'s locally-decoded cookie for an authorization decision), and redirects signed-out
requests to `/login`. Its `matcher` covers `/dashboard/:path*` and `/login` only — it does not
cover `/api/**`; API routes enforce their own auth independently.

**Local demo-mode fallback.** `DEMO_USER_EMAIL` lets local development skip Google OAuth
entirely. It is gated by `src/lib/auth/demo-mode.ts::isDemoModeActive()`:

```ts
return process.env.NODE_ENV !== "production" && !!process.env.DEMO_USER_EMAIL;
```

This is deliberately gated on `NODE_ENV`, not Vercel's `VERCEL_ENV` — `next build` always sets
`NODE_ENV=production` regardless of Vercel target, so demo mode is inert on **both** Preview and
Production, not just Production. Preview deployments must exercise real Google sign-in.

## Application User Provisioning

An authenticated Supabase identity alone is not sufficient. `src/lib/auth/current-user.ts`
resolves the signed-in email to a matching `AppUser` row and requires `isActive: true`; a
session with no matching row, or an inactive one, resolves to a distinct **"unprovisioned"**
status (not "unauthenticated"). The three states:

| State | Trigger | Layout behavior |
|---|---|---|
| `unauthenticated` | no Supabase session (and demo mode inactive) | redirect to `/login` |
| `unprovisioned` | valid session, no matching active `AppUser` | redirect to `/not-authorized` |
| `ok` | valid session, matching active `AppUser` | render the dashboard |

`getCurrentUser()` (the back-compat wrapper most call sites use) collapses the first two into
`null` — per its own comment, no downstream call site needs to distinguish "no session" from
"session, no matching row."

## Roles

Six roles (`UserRole` in `prisma/schema.prisma`): `EXECUTIVE`, `PROGRAM_MANAGER`, `MENTOR`,
`ANALYST_ADMIN`, `FINANCE`, `SELECTION_TEAM`.

## Permissions

Eight permission constants (`Permission` in `src/lib/auth/authorization.ts`):
`VIEW_DASHBOARD`, `VIEW_SCHOLAR_TRACKING`, `VIEW_SENSITIVE_NOTES`, `VIEW_UNIT_ECONOMICS`,
`VIEW_SELECTION_PIPELINE`, `MANAGE_DATA`, `VIEW_IMPORTS`, `MANAGE_IMPORTS`.

`ROLE_PERMISSIONS`, verbatim from the code:

| Role | Permissions |
|---|---|
| `EXECUTIVE` | `VIEW_DASHBOARD`, `VIEW_SCHOLAR_TRACKING`, `VIEW_UNIT_ECONOMICS`, `VIEW_SELECTION_PIPELINE` |
| `PROGRAM_MANAGER` | `VIEW_DASHBOARD`, `VIEW_SCHOLAR_TRACKING`, `VIEW_SENSITIVE_NOTES`, `VIEW_UNIT_ECONOMICS`, `VIEW_SELECTION_PIPELINE`, `VIEW_IMPORTS` (read-only) |
| `MENTOR` | `VIEW_DASHBOARD`, `VIEW_SCHOLAR_TRACKING`, `VIEW_SENSITIVE_NOTES` |
| `ANALYST_ADMIN` | all eight — the superset |
| `FINANCE` | `VIEW_DASHBOARD`, `VIEW_UNIT_ECONOMICS` |
| `SELECTION_TEAM` | `VIEW_DASHBOARD`, `VIEW_SELECTION_PIPELINE` |

`can(user, permission)` is a pure lookup into this table. Every dashboard page and mutating API
route calls `requirePermission()` (`src/lib/auth/guard.ts`) for its own permission before
rendering or acting — this is not inferred from which nav links happen to be visible.

## Scholar-Level Access

Beyond the section-level permission, `MENTOR` is further restricted to their assigned scholars:

```ts
// canAccessScholar()
if (!can(user, P.VIEW_SCHOLAR_TRACKING)) return false;
if (user.role === "MENTOR") return user.assignedScholarIds.includes(scholarId);
return true;
```

```ts
// scholarAccessWhere() — the Prisma where-fragment every scholar list/detail query applies
if (user?.role === "MENTOR") return { scholarId: { in: user.assignedScholarIds } };
return {};
```

A mentor with **no** assignments matches **no** scholars — never "everything." Non-mentor roles
with `VIEW_SCHOLAR_TRACKING` are unrestricted at the scholar level.

**UI hiding is not sufficient.** `src/app/dashboard/layout.tsx` states this directly in its own
comment: its redirect-on-mount is a *"fast-path UX redirect only... guard.ts's per-page checks
remain the real enforcement boundary, since Layouts don't re-render on client-side navigation
between sibling routes they wrap."* Every dashboard page independently calls
`requirePermission()`/`requireScholarAccess()`; the scholar-profile page additionally calls
`canAccessScholar()` before rendering, and the query layer applies `scholarAccessWhere()`
regardless — so even a direct, authorized-permission request for an out-of-scope `scholarId`
returns nothing.

**One observed exception**, noted here as-is rather than silently fixed: `admin/imports/new/page.tsx`
is a client component with no page-level `requirePermission()` call of its own. It renders only a
static upload form; the two API routes it calls (`POST /api/admin/imports`,
`POST /api/admin/imports/[id]/commit`) are independently guarded (`VIEW_IMPORTS` /
`MANAGE_IMPORTS`), so no data is exposed by loading the page — but the page's own protection
comes from nav-visibility plus those downstream API guards, not from a guard of its own, unlike
every other page in the app.

## Sensitive Data

Scholar records can include: contact details (`email1`, `email2`, `mobilePhone`), `dateOfBirth`,
`gender`, `ethnicGroup`, `socioeconomicLevel`, geographic origin/residence fields, parents'
education level, and academic/risk data. `VIEW_SENSITIVE_NOTES` gates the more sensitive fields
in the UI, layered on top of `VIEW_SCHOLAR_TRACKING` and scholar-level scoping. No compliance
certification (SOC 2, HIPAA, etc.) is claimed or implied by this document or the codebase.

## Imports

`VIEW_IMPORTS` (read the import list/detail/data-quality issues) and `MANAGE_IMPORTS` (commit or
roll back a batch) are separate permissions — `PROGRAM_MANAGER` has the former only,
`ANALYST_ADMIN` has both.

`POST /api/sync/import` (the Google Sheets pipeline's endpoint) uses a **separate**,
machine-to-machine auth mechanism: a constant-time-compared (`timingSafeEqual`) `x-api-key`
header against `SHEETS_SYNC_API_KEY`, not a Supabase session or `AppUser` role. This is
intentional — Apps Script is not a logged-in user — but it means this endpoint's authorization
model is distinct from every other route in the app, and `SHEETS_SYNC_API_KEY` should be treated
with the same care as a production credential.

## Security Change Policy

Authentication, authorization, identity, and data-access changes require an ADR
(`docs/adr/`) and explicit review — see `AGENTS.md`.
