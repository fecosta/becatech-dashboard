# ADR-009 — Supabase Storage for Scholar Photos

Status: Accepted
Date: 2026-09-10

## Context

Colombia scholar photos have been prepared and uploaded to a private Supabase Storage
bucket (`scholar-photos/colombia/{scholarId}.webp`), and the Scholar Profile page needs to
display them in place of a decorative gradient placeholder, without making the bucket
public and without persisting signed URLs (`resources/tasks/active/001-task-scholar-photos.md`).

Supabase has so far only been used in this codebase for Auth (`@supabase/ssr`, the
anon/publishable key) — reading a private Storage bucket requires a service-role
credential, a materially more privileged credential class than anything the application
has used before (it bypasses Row Level Security and grants full bucket access, not just
the signed-in user's own session). AGENTS.md lists "external integrations (Supabase,
...)" as requiring an ADR; this is the first time Supabase Storage, or any service-role
credential, has entered the codebase.

## Decision

A new server-only client factory, `src/lib/supabase/admin.ts`, constructs a Supabase
client from `SUPABASE_SERVICE_ROLE_KEY` (a new, non-`NEXT_PUBLIC_`-prefixed env var) using
plain `createClient` from `@supabase/supabase-js` — not `@supabase/ssr`'s cookie-bound
factories, since a service-role client has no user session. The file is guarded with
`import "server-only"` so any accidental import from client code fails the build, and it
is imported only by `src/lib/scholars/photos.ts`.

`src/lib/scholars/photos.ts` centralizes the storage-path convention
(`getScholarPhotoPath`) and signed-URL generation (`getScholarPhotoUrl`, TTL: 60 seconds,
centralized as `SCHOLAR_PHOTO_SIGNED_URL_TTL_SECONDS`). It performs no authorization check
of its own — it is only ever called from `src/components/ScholarProfileView.tsx`, after
`getScholarProfile()` has already returned a non-null, access-scoped result for the
requested `scholarId` (i.e. after the page's `canAccessScholar()` gate and the query's own
mentor-scoping recheck have both already passed). No new Route Handler or other endpoint
is introduced: there is no way to request a signed URL for an arbitrary `scholarId`
outside the existing, already-authorized Scholar Profile render path.

This introduces **no new authorization model**. `canAccessScholar()`, `scholarAccessWhere()`,
and `getScholarProfile()`'s mentor-scoping check (`docs/adr/004-role-and-scholar-access-control.md`)
are reused unchanged.

## Consequences

- A second class of Supabase credential now exists in the codebase: the anon/publishable
  key (used for Auth, safe to expose to the browser) and the service-role key (full
  Storage access, server-only, never `NEXT_PUBLIC_`-prefixed). Any future Storage usage
  should go through `src/lib/supabase/admin.ts` rather than introducing a second
  service-role client.
- `SUPABASE_SERVICE_ROLE_KEY` must be set in Vercel (Production and Preview, as needed)
  for real photo resolution to occur; its absence degrades to "no photo" (the profile
  falls back to its placeholder/initials avatar), not an error.
- Any future Storage bucket, or any change to who may call `getScholarPhotoUrl`, should
  extend `src/lib/scholars/photos.ts`'s existing pattern (country/domain-keyed path
  resolution behind an already-authorized call site) rather than introduce a new
  unauthenticated or loosely-scoped signing path.

## Alternatives Considered

No repository evidence of an alternative Storage-access approach (e.g. public bucket,
persisted signed URLs, a dedicated signing API route) having been implemented or
documented — omitted rather than invented. The task doc
(`resources/tasks/active/001-task-scholar-photos.md`) explicitly rules out a public
bucket, persisted URLs, and a new unauthenticated signing endpoint as non-goals.
