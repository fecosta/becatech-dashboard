Task: Add scholar photos to the Scholar Profile using private Supabase Storage

Repository: fecosta/becatech-dashboard

Start from the latest merged main.

Current known main includes commit:

a3ae756 fix: scope dashboard filters and clarify scholar semester

Do not assume this is still HEAD when you begin. Check the current repository state first.

1. Read first

Before changing code, inspect:

* AGENTS.md
* relevant files under resources/specs/
* resources/design-reference/ for current scholar-profile visual guidance
* relevant security/auth documentation under resources/
* prisma/schema.prisma
* src/components/ProfileCard.tsx
* src/components/ScholarProfileView.tsx
* current scholar profile route/page
* existing Supabase client/configuration code
* existing authentication and scholar-level authorization code
* existing environment-variable conventions
* relevant tests

Also search the repository for:

* existing avatar/profile-image components
* existing Supabase Storage usage
* signed URL generation
* service-role usage
* scholar authorization helpers
* scholarId
* Country

Reuse existing primitives and infrastructure when appropriate instead of creating parallel abstractions.

2. Current situation

Scholar photos have already been manually prepared and uploaded to a private Supabase Storage bucket.

Storage convention:

bucket: scholar-photos
colombia/
  {scholarId}.webp

Example:

scholar-photos/
  colombia/
    0987654321.webp
    5432167890.webp

All Colombia scholar photos have already been:

* converted to WebP;
* resized/optimized;
* visually checked;
* normalized to {scholarId}.webp;
* cleaned so the original JPG/PNG/CR2 files are no longer required.

The canonical scholar identity remains:

Scholar.scholarId

which maps to program ID_becario.

Do not match photos by name, email, phone, or fuzzy text.

The current ProfileCard uses a decorative gradient block as the scholar avatar placeholder. Replace that placeholder with the real scholar photo when one exists.

3. Goal

Implement the first phase of scholar-photo support on the individual Scholar Profile only.

For a Colombia scholar with:

scholarId = 0987654321

the application should resolve:

colombia/0987654321.webp

from the private scholar-photos Supabase Storage bucket.

The Scholar Profile should:

* show the real scholar photo when available;
* preserve approximately the current avatar dimensions and rounded treatment;
* crop with object-cover;
* gracefully fall back to the current visual placeholder or an initials-based fallback when no photo exists or the image cannot be loaded;
* not make the entire Scholar Profile fail because a photo is missing.

4. Non-goals / constraints

Do NOT:

* modify the spreadsheet ingestion pipeline;
* add photo ingestion;
* add Google Drive integration;
* add a photoUrl field to Prisma;
* add a database migration;
* store signed URLs in PostgreSQL;
* make the scholar-photos bucket public;
* expose the Supabase service-role key to client-side code;
* change scholar identity semantics;
* modify Contact Prioritisation yet;
* modify Find a Scholar yet;
* redesign the Scholar Profile;
* modify dashboard metrics;
* change risk logic;
* change existing authorization behavior;
* refactor unrelated Supabase/database/auth infrastructure.

This task is intentionally limited to proving the private-photo integration on the Scholar Profile.

5. First deliverable: implementation audit

Before making substantial edits, report briefly:

1. where the Scholar Profile data is loaded;
2. whether that code executes server-side;
3. how scholar-level authorization is currently enforced;
4. what Supabase client/configuration already exists;
5. whether a server-only Supabase/admin client already exists;
6. where the current profile placeholder is rendered;
7. whether an existing avatar component can be reused;
8. the smallest safe implementation path.

Do not start a broad architectural refactor.

6. Photo path convention

Centralize the storage-path construction instead of embedding string interpolation throughout React components.

Conceptually:

getScholarPhotoPath({
  scholarId,
  country,
})

For now:

COLOMBIA
→ colombia/{scholarId}.webp

Design this helper so adding Peru later is straightforward, but do not implement speculative storage structures beyond what is useful.

Do not lowercase, parse as a number, or otherwise mutate scholarId.

Leading zeros are significant.

For example:

0987654321

must remain:

0987654321

and resolve exactly to:

colombia/0987654321.webp

7. Private Storage access

The scholar-photos bucket must remain private.

Generate short-lived signed URLs on the server.

Prefer the existing server-side Supabase infrastructure if one already exists.

Do not instantiate or expose a service-role client inside a client component.

Do not send the service-role key to the browser.

Use the project’s existing environment variable conventions.

If the application currently has no suitable server-side Supabase Storage client, introduce the smallest server-only helper necessary.

Any service-role credential must only be imported/used from server-only code.

The browser may receive the resulting temporary signed URL.

Choose a reasonable signed-URL lifetime. Centralize that value rather than scattering magic numbers.

Do not persist signed URLs.

8. Authorization requirement

A signed URL must only be generated after the existing application has established that the current user may access that scholar.

Do not treat possession of a valid scholar ID as authorization.

Preserve the current scholar-level authorization flow.

Do not create a new unauthenticated endpoint that takes an arbitrary scholar ID and returns a signed URL.

If photo resolution is naturally performed as part of the already-authorized server-side Scholar Profile query/page, prefer that architecture.

9. Missing-photo behavior

Missing photos are expected and are not application errors.

If:

colombia/{scholarId}.webp

does not exist, the Scholar Profile must continue rendering.

Do not log normal missing-photo cases as severe application errors.

Return something conceptually equivalent to:

photoUrl: null

and let the UI display the fallback.

Unexpected Storage/auth/configuration failures should still be distinguishable from a normal missing object.

10. UI implementation

Create or reuse a small reusable scholar-avatar component if doing so improves separation.

Conceptually:

<ScholarAvatar
  src={photoUrl}
  name={fullName}
  size="profile"
/>

Do not put Supabase Storage logic inside the avatar component.

The component should focus on presentation.

For the existing large ProfileCard avatar:

* preserve approximately 104px × 104px;
* preserve the current rounded shape;
* use object-cover;
* include meaningful alt text;
* avoid layout shift;
* provide a robust fallback.

Do not redesign the surrounding identity card.

11. Country behavior

Only Colombia photos are currently known to exist.

Handle this explicitly.

For Colombia:

colombia/{scholarId}.webp

For countries without a configured photo source, return no photo and render the fallback.

Do not accidentally request:

peru/{scholarId}.webp

unless the implementation deliberately supports that convention and doing so is harmless.

Keep country-to-folder mapping centralized.

12. Tests

Add focused tests for the new behavior.

At minimum cover:

Path construction

Country: COLOMBIA
Scholar ID: 0987654321
Expected:
colombia/0987654321.webp

Verify leading zeros are preserved.

Unsupported/no-photo country

A country without a configured photo location should resolve safely to no photo/fallback behavior.

Missing object

A missing Storage object must not break profile rendering.

Signed URL

Where practical, mock the Storage client and verify that the expected object path is used.

UI fallback

Verify that the avatar renders its fallback when src is null/unavailable.

Do not write tests that expose real service-role credentials or depend on production Supabase.

13. Security review

As part of self-review, explicitly verify:

* service-role credentials cannot enter the client bundle;
* signed URLs are generated server-side;
* signed URLs are only generated in an already-authorized scholar flow;
* no public bucket conversion was introduced;
* no arbitrary scholar-photo signing endpoint was introduced;
* scholar IDs with leading zeros remain intact.

Treat any failure here as a blocker.

14. Documentation

Do not create an ADR or Prisma migration for this task unless repository inspection reveals an existing architectural requirement that clearly demands one.

This implementation does not change canonical scholar identity or database persistence.

If an active SPEC owns Scholar Profile behavior, update it only if necessary to document the implemented photo behavior.

Do not recreate a root-level /specs directory.

Use only:

resources/specs/

for specs.

15. Validation

Run the repository’s actual validation commands.

At minimum, where available:

npm test
npm run lint
npm run build

Use the project’s real package manager/scripts if they differ.

Also run focused tests for the photo functionality.

Do not claim visual QA unless you actually opened the application in a browser and inspected a real Scholar Profile.

If browser QA is available, verify:

1. a Colombia scholar with a known photo;
2. a scholar without a photo;
3. image cropping/rounded appearance;
4. fallback behavior;
5. no visible layout regression.

If real Supabase credentials are unavailable in your environment, clearly distinguish mocked/structural validation from actual Storage integration testing.

16. Self-review

After implementation, review your own diff as a senior engineer and answer:

1. Did I expose any privileged Supabase credential client-side?
2. Can an unauthorized user generate a signed URL for an arbitrary scholar?
3. Is the canonical scholarId preserved exactly, including leading zeros?
4. Does a missing image break the Scholar Profile?
5. Did I add unnecessary database persistence?
6. Did I duplicate Storage logic inside React components?
7. Did I accidentally expand scope into Contact Prioritisation or Find a Scholar?
8. Did I change anything unrelated to this feature?

Fix issues found before completing the task.

17. Commit

Follow the repository’s commit convention.

Use a Conventional Commit, for example:

feat: add scholar profile photos

Use the configured sole git author.

Do not add:

Co-Authored-By: Claude

or any other co-author.

18. Final report

Return a concise structured report containing:

Audit

* existing profile data/auth flow;
* existing Supabase infrastructure;
* chosen implementation approach.

Files changed

For each file, state why it changed.

Behavior

Confirm:

* expected Storage path;
* signed URL lifetime;
* missing-photo behavior;
* fallback behavior;
* Colombia-only behavior.

Security

Confirm:

* where signed URLs are created;
* how authorization is preserved;
* that service-role credentials remain server-only.

Tests

List every command actually executed and its result.

Visual QA

State exactly what was or was not visually tested.

Non-goals preserved

Confirm:

* no Prisma migration;
* no ingestion changes;
* no Google Drive integration;
* no Contact Prioritisation changes;
* no Find a Scholar changes.

Commit

Provide the final commit SHA and commit message.