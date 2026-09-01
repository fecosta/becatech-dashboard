# ADR-003 — Supabase Auth and AppUser

Status: Accepted
Date: 2026-09-01 (documenting an already-established decision)

## Context

The application needs to know not just *who* is signed in, but *whether that person is a
provisioned user of this specific program dashboard*, and *what role they hold*. An identity
provider alone (Supabase Auth / Google) can confirm who someone is; it cannot express Beca Tech+
program roles or scholar-level access grants.

## Decision

Supabase Auth (with Google sign-in) handles identity — confirming who is signed in.
`src/lib/auth/current-user.ts` then resolves that identity's email against an `AppUser` row in
the application database. Authorization is based on that matching, **active** `AppUser`:

```prisma
model AppUser {
  id       String   @id @default(cuid())
  fullName String
  email    String   @unique
  role     UserRole
  isActive Boolean  @default(true)
  ...
}
```

An authenticated-but-unprovisioned user (a valid Supabase session with no matching `AppUser` row,
or a row with `isActive: false`) is a distinct state — `"unprovisioned"` — from an unauthenticated
one, and is handled separately (see `docs/SECURITY.md`).

A local-only `DEMO_USER_EMAIL` fallback lets development proceed without configuring Google
OAuth. It is gated on `NODE_ENV !== "production"` and is a development convenience only — never
active in a real deployment, Preview or Production.

## Consequences

- Every dashboard page's authorization decision ultimately depends on an `AppUser` row existing
  and being active, not just on a Supabase session.
- Deactivating access (e.g. someone leaves the program) is done by setting `AppUser.isActive =
  false`, not by removing their Supabase account.
- `prisma/seed-users.ts` is the only script that writes real `AppUser` rows and is explicitly
  safe to run against production (it never touches scholar or other program data).
- Any change to how identity resolves to authorization (a different provider, a different
  provisioning model) requires a new ADR.

## Alternatives Considered

No repository evidence of an alternative identity/provisioning model having been implemented or
documented — omitted rather than invented.
