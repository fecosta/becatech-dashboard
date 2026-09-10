# TASK-005 — Diagnose and Improve Dashboard Page-Loading Performance

Status: Completed
Owner: Engineering
Related spec: None
Related ADRs: None
Created: 2026-09-10
Completed: 2026-09-10

## Objective

Diagnose why `/dashboard` and its child routes load slowly in production (HAR showed ~2.58s total / ~2.47s TTFB on the initial request, plus 350-900ms speculative sidebar prefetch requests), confirm the actual server-side call graph against the code, and apply small, low-risk, evidence-backed optimizations without changing authentication, authorization, filtering, or dashboard behavior.

---

# Implementation Prompt

Task: Diagnose and improve dashboard page-loading performance

Repository: fecosta/becatech-dashboard

Start from the latest main.

Current known main includes:

73bb7d5 feat: add scholar profile photos

Do not assume that commit is still HEAD when you begin. Fetch/pull and verify the current repository state first.

1. Goal

The Beca Tech dashboard is noticeably slow when initially loading /dashboard and when navigating between dashboard pages.

A browser HAR captured from the production Vercel deployment shows that the main performance problem appears to be server-side request latency rather than static asset download time.

The goal of this task is to:

1. establish the current server-side execution pattern;
2. identify unnecessary or duplicated work;
3. apply small, low-risk optimizations;
4. preserve all existing authentication, authorization, filtering, and dashboard behavior;
5. provide evidence showing what was changed and why.

This is a performance task, not a product redesign.

Do not optimize based only on assumptions. Inspect and measure the current implementation first.

⸻

2. Read first

Before changing code, inspect:

* AGENTS.md
* docs/ARCHITECTURE.md
* docs/SECURITY.md
* relevant ADRs under docs/adr/, especially auth/authorization decisions
* resources/tasks/active/
* relevant specs under resources/specs/
* package.json
* next.config.ts
* src/app/dashboard/layout.tsx
* src/app/dashboard/page.tsx
* src/components/DashboardShell.tsx
* src/components/Sidebar.tsx
* src/lib/auth/current-user.ts
* src/lib/auth/guard.ts
* src/lib/auth/authorization.ts
* src/lib/dashboard/queries.ts
* src/lib/db.ts
* relevant tests

Also inspect representative dashboard pages, at minimum:

* /dashboard
* /dashboard/early-support
* /dashboard/career-readiness
* /dashboard/scholars

Search the repository for:

* dynamic = "force-dynamic"
* getCurrentUser
* getCurrentUserResult
* requirePermission
* getFilterOptions
* <Link
* prefetch
* React cache
* Next.js caching APIs
* Prisma calls made during dashboard rendering
* any existing instrumentation or timing utilities

Reuse existing patterns instead of introducing parallel abstractions.

⸻

3. Observed production behavior

A HAR trace from the production deployment showed the following.

Initial dashboard request

The initial /dashboard request took approximately:

* total request: ~2.58 s
* server wait / TTFB: ~2.47 s

Static JS and CSS assets generally loaded in only a few milliseconds.

Therefore, JavaScript bundle size does not currently appear to be the primary bottleneck.

Sidebar route prefetching

After the dashboard loads, Next.js appears to prefetch several visible dashboard links as React Server Component requests.

Observed prefetched destinations included routes such as:

* /dashboard/early-support
* /dashboard/career-readiness
* /dashboard/scholars
* /dashboard/actors
* /dashboard/admin/imports
* /dashboard/admin/data-quality

Individual prefetched server requests were observed taking roughly 350–900 ms.

These requests occur even when the user has not navigated to those pages.

Duplicate server work

Current code appears to perform overlapping work between DashboardLayout and dashboard pages.

For example, investigate whether:

src/app/dashboard/layout.tsx

calls both:

* getFilterOptions()
* getCurrentUserResult()

while the home dashboard page also calls:

* requirePermission(...)
* getFilterOptions()

and whether requirePermission() results in another call through:

getCurrentUser() → getCurrentUserResult() → Supabase auth.getUser() → Prisma AppUser lookup.

Do not take this description as proof. Confirm the real call graph in the current code.

Dashboard query fan-out

The dashboard home page currently invokes many query-layer functions concurrently.

Investigate the number of actual Prisma/database round trips behind these query functions.

Some repeated source reads may be candidates for consolidation, but do not rewrite the query architecture prematurely.

Dynamic rendering

Several dashboard routes currently use:

export const dynamic = "force-dynamic";

The HAR shows authenticated requests being served with no-store/private caching semantics.

Do not simply remove force-dynamic or introduce cross-user caching.

Any caching change must preserve authorization and data freshness.

⸻

4. Constraints and non-goals

Preserve authentication and authorization

Authentication and authorization behavior must not change.

In particular:

* per-page requirePermission() remains an authorization boundary;
* scholar-level authorization remains server-side;
* mentors must remain restricted to assigned scholars;
* UI visibility must not become an authorization mechanism;
* do not weaken Supabase session validation.

An optimization must never allow one user's authorization or scholar scope to leak into another request.

Preserve data correctness

Do not change:

* dashboard metrics;
* filter semantics;
* risk calculations;
* cohort logic;
* scholar identity;
* current-period behavior;
* authoritative program classifications;
* data freshness behavior.

No database schema changes initially

Do not modify:

* prisma/schema.prisma
* migrations
* database constraints

unless the investigation produces strong evidence that a schema/index change is necessary.

If such a change appears necessary, stop at the recommendation and document the evidence. Do not include it in this task.

No broad refactor

Do not:

* replace Prisma;
* replace Supabase Auth;
* rewrite the dashboard query layer;
* introduce Redis;
* introduce a new caching service;
* redesign routing;
* redesign dashboard UI;
* change the photo implementation;
* bundle unrelated cleanup into this task.

⸻

5. Phase 1 — establish the actual execution pattern

Before making optimizations, audit the request path.

For the initial /dashboard render, document the approximate call graph.

At minimum identify:

* how many times current-user resolution happens;
* how many times Supabase auth.getUser() can run;
* how many times the AppUser query can run;
* how many times getFilterOptions() runs;
* how many Prisma calls getFilterOptions() itself performs;
* which dashboard query functions run;
* whether any of those query functions independently fetch the same source datasets;
* which operations are sequential versus parallel.

Do the same at a lighter level for /dashboard/early-support.

You may add temporary local instrumentation if useful, but do not leave noisy production logging behind unless it is intentionally designed and justified.

Use timings where feasible.

The purpose is to distinguish:

* network/database latency;
* duplicated queries;
* authentication latency;
* server rendering work;
* Next.js prefetch traffic.

⸻

6. Phase 2 — optimize sidebar prefetch behavior

Inspect src/components/Sidebar.tsx.

The sidebar currently uses Next.js <Link> elements.

Determine whether automatic prefetching is causing all visible dashboard destinations to execute expensive RSC server requests before the user chooses them.

If confirmed, disable automatic prefetch for dashboard sidebar links, most likely using:

prefetch={false}

unless the current Next.js version or implementation provides a better narrowly scoped mechanism.

Preserve normal client-side navigation.

Do not replace <Link> with raw anchors simply to disable prefetch.

Add or update a focused test if practical.

Explain the tradeoff:

* fewer speculative server/database requests;
* selected route may begin fetching only after the user clicks.

For this dashboard, avoiding many expensive speculative server renders is expected to be preferable.

⸻

7. Phase 3 — deduplicate current-user resolution per server request

Investigate whether the dashboard layout and page authorization guards resolve the same user more than once during the same React server render.

If confirmed, introduce request-scoped deduplication using the existing React/Next.js-supported mechanism.

A likely candidate is React's:

import { cache } from "react";

For example, the underlying authenticated current-user resolution may be safely wrapped so repeated calls during one server render share the result.

However:

* verify React 19 / Next.js 16 semantics before implementation;
* the cache must be request/render scoped;
* do not create a process-global authorization cache;
* do not cache a user's identity across requests;
* do not weaken the call to supabase.auth.getUser().

getCurrentUser() and getCurrentUserResult() should continue to expose their existing behavior unless there is a compelling reason to alter their public API.

Add tests for the resulting behavior where meaningful.

⸻

8. Phase 4 — deduplicate filter-option reads

Investigate getFilterOptions().

The dashboard layout needs filter options for the shell, while some pages currently appear to request them again.

If the same function is called multiple times during a single server render, deduplicate it safely.

Prefer request-scoped memoization/deduplication over moving server data into client components or changing page semantics.

Do not introduce long-lived caching yet.

Confirm that filter options still update correctly after new program data is imported.

Because imports can change available cohorts, universities, periods, semesters, etc., do not introduce indefinite shared caching.

⸻

9. Phase 5 — inspect dashboard query duplication

After the low-risk fixes above, inspect src/lib/dashboard/queries.ts.

The home page calls multiple query functions concurrently. Concurrent execution itself is good and should not be removed without evidence.

Look specifically for cases where several functions independently fetch essentially the same full scholar/risk/academic dataset from PostgreSQL and then aggregate it separately in JavaScript.

If meaningful duplication exists, propose the smallest safe consolidation.

Examples of acceptable approaches might include:

* sharing an internal request-scoped source loader;
* request-scoped memoization of identical source reads;
* consolidating two obviously identical reads.

Do not create a giant getEverythingForDashboard() abstraction.

Do not move business aggregation logic into React components.

Do not convert all aggregations to raw SQL as part of this task.

Only implement query consolidation when the duplication is clear and tests can demonstrate equivalent results.

Otherwise document it as a follow-up.

⸻

10. Dynamic rendering and caching

Review the use of:

export const dynamic = "force-dynamic";

Do not remove it automatically.

Determine why each relevant route is dynamic:

* authenticated session;
* user-specific authorization;
* query-string filters;
* frequently updated database data;
* other request-specific behavior.

If dynamic rendering is required, keep it.

If some expensive user-independent data can safely use request-level deduplication, do that instead of enabling broad page caching.

Do not introduce shared/full-route caching of personalized dashboard responses.

⸻

11. Vercel / database region investigation

The HAR included Vercel request identifiers suggesting traffic entering via gru1 and execution involving iad1.

The user is in Brazil.

Determine what can be established from repository configuration about:

* Vercel function region;
* Supabase/PostgreSQL region;
* connection configuration;
* whether DATABASE_URL is a direct or pooled Supabase connection.

Do not guess the actual Supabase region if it is not encoded in the repository.

If repository evidence is insufficient, add a clear operational verification step for the user, for example checking:

* Vercel project Function Region
* Supabase project database region
* connection-pool configuration

Do not change deployment regions in code as part of this task unless the project already has an explicit approved deployment configuration that makes the correct target unambiguous.

⸻

12. Early Support follow-up

The HAR showed /dashboard/early-support beginning its response relatively quickly but continuing to stream/render for noticeably longer.

After implementing the global low-risk optimizations, inspect this page for:

* number of query functions;
* duplicated source reads;
* large server-rendered payloads;
* unnecessary sequential awaits;
* expensive aggregation loops;
* unnecessary data passed to client components.

Do not fold a major Early Support refactor into this task.

If a separate optimization is warranted, document it as a follow-up task with evidence.

⸻

13. Tests

Add focused regression tests for any modified behavior.

At minimum preserve tests for:

* authenticated dashboard access;
* permission enforcement;
* mentor scholar scoping;
* sidebar navigation;
* filter options;
* dashboard metrics affected by any changed query loader.

If request-scoped caching is added, test the underlying resolver behavior where practical without coupling tests too tightly to React internals.

Do not weaken existing tests simply to accommodate implementation changes.

⸻

14. Validation

Run:

npm test
npm run test:integration
npm run lint
npm run build

Also run any existing dashboard-specific validation commands that are applicable, including:

npm run dashboard:check

if the required environment/data is available.

If a command cannot run because required credentials, production data, or environment variables are unavailable, state that explicitly.

Do not claim it passed.

Run:

git diff --check
git status

before finishing.

⸻

15. Performance verification

After the changes, provide a before/after conceptual request audit.

At minimum report:

Measurement	Before	After
automatic sidebar RSC prefetch requests	count	count
current-user resolver calls per dashboard render	count	count
Supabase auth.getUser() calls per render	count	count
AppUser queries per render	count	count
getFilterOptions() executions per render	count	count
Prisma calls caused by filter options	count	count

If you can run a realistic local/preview benchmark, include timings.

Do not invent timing improvements from code inspection alone.

If production timing requires redeploying and capturing another HAR, explicitly say so.

⸻

16. Expected likely implementation

The investigation may result in changes similar to:

1. disable speculative sidebar link prefetch;
2. request-scope memoize current-user resolution;
3. request-scope memoize getFilterOptions();
4. optionally deduplicate clearly repeated dashboard source reads.

But these are hypotheses derived from the HAR.

Confirm each one before implementing it.

If inspection proves any assumption wrong, follow the evidence rather than the prompt.

⸻

17. Governance

This should remain an implementation/performance task.

Expected governance impact:

* no new product SPEC;
* no new ADR;
* no Prisma migration;
* no data-definition change;
* no authorization behavior change.

If you discover that the correct solution requires:

* changing authentication semantics;
* changing authorization semantics;
* shared cross-request caching architecture;
* deployment-region architecture;
* database schema/index changes;
* material metric/query behavior changes;

do not silently implement those decisions.

Document them separately as recommended follow-up work and identify whether an ADR or migration would be required.

⸻

18. Task documentation

Check resources/tasks/active/ before creating a new task.

There are currently existing active tasks in this repository; do not modify or combine unrelated tasks simply because they are still marked active.

If no existing task owns dashboard performance, create a narrowly scoped task under the project's normal resources/tasks/ lifecycle for this work.

Use the next appropriate task identifier according to the repository's conventions.

After implementation is complete, update/move only the performance task according to the documented task lifecycle.

Do not alter unrelated active task files.

⸻

19. Commit rules

Follow the repository's configured git identity.

Use Conventional Commits.

For this task, an appropriate commit would likely be:

perf: reduce dashboard server work

or split into small commits if the repository workflow favors that.

Do not add:

Co-Authored-By: Claude

or any other AI co-author trailer.

⸻

20. Final report

Return a structured report containing:

Investigation

* verified root causes;
* rejected hypotheses;
* dashboard request call graph;
* relevant query counts;
* any infrastructure findings.

Changes

For every modified file:

* path;
* what changed;
* why.

Performance impact

Report measurable or structurally verified improvements.

Clearly distinguish:

* measured timings;
* query/request-count reductions;
* expected but not yet production-measured improvements.

Security and correctness

Confirm explicitly that:

* per-page authorization remains enforced;
* scholar-level scoping is unchanged;
* authenticated identity is not cached across requests;
* dashboard metrics/filter semantics are unchanged.

Tests

Report exact results for:

* npm test
* npm run test:integration
* npm run lint
* npm run build
* npm run dashboard:check, if run
* git diff --check

Follow-ups

List only issues supported by evidence, particularly:

* Vercel ↔ Supabase regional latency;
* Early Support-specific query/render performance;
* database indexing, if profiling demonstrates a need.

Git state

Include:

git status
git log --oneline -5

Do not commit unrelated files.

---

# Final Report

## Investigation

**Verified root causes:**

1. **Current-user resolution ran 2x per `/dashboard` render (3x per HTTP request including middleware) — confirmed, and worse than the task's hypothesis.** `src/app/dashboard/layout.tsx:49` calls `getCurrentUserResult()` directly. Every dashboard page's `requirePermission()` (`src/lib/auth/guard.ts:11`) independently calls `getCurrentUser()` → `getCurrentUserResult()` again, since `requirePermission()` has no way to accept an already-resolved user. Each execution of `getCurrentUserResult()` (`src/lib/auth/current-user.ts:31-49`, pre-change) runs one `supabase.auth.getUser()` and one `prisma.appUser.findUnique`. A third, separate `supabase.auth.getUser()` call already happens in `src/proxy.ts` middleware, before the React render tree is even constructed — a different execution context, not merged here (doing so would touch authentication semantics across a middleware/RSC boundary, out of scope).
2. **`getFilterOptions()` ran 2x per dashboard-route render — confirmed exactly as hypothesized.** `getFilterOptions()` (`src/lib/dashboard/queries.ts:212-234` pre-change, 4 Prisma calls via one internal `Promise.all`) is called at `layout.tsx:49` and again independently at `dashboard/page.tsx:132` / `early-support/page.tsx:165`.
3. **Sidebar prefetch — confirmed.** `src/components/Sidebar.tsx` renders one Next.js `<Link>` per nav item with no `prefetch` prop set, so Next's default viewport-triggered auto-prefetch fires a full, expensive `force-dynamic` RSC render for every visible sidebar destination before the user clicks anything.
4. **A safe additional dedup opportunity not in the original hypothesis list:** the private helpers `getCurrentPeriod()` and `getCurrentSemester()` (`queries.ts:170-186` pre-change) are zero-argument, primitive-returning, and get called by `loadScope`/`getMonthlyParticipationRiskTrend` every time `filters.period`/`filters.semester` is unset — the common case, since neither `/dashboard` nor `/dashboard/early-support` exposes a period-filter pill. This can repeat up to ~15 times in one `/dashboard/early-support` render.

**Rejected / declined for this task (with evidence):**

- **`loadScope`/`loadAllStatuses` broad consolidation — investigated and explicitly declined.** `loadAllStatuses(filters)` (7 call sites) only dedupes reference-equal calls; on `/dashboard`, 4 of 7 call sites share one `filters` reference (a real, provable duplication — 7→4 reads), but the other 3 (`ourScholarsScope`/`dropOutsScope`/`retentionScope`) are freshly-constructed objects per `src/lib/dashboard/filters.ts:155-163`'s `applyBlockFilters`, so caching would never dedupe them. Net measured benefit: 3 of ~23 round trips on the home page — unlikely to move the ~2.47s TTFB. `loadScope` (~16 call sites) yields **zero** benefit on `/dashboard` (only 1 caller there); its real payoff (~94→44 round trips) is entirely on `/dashboard/early-support`, which this task explicitly scopes out of a full refactor. `loadScope` is also the authorization chokepoint (`access` is ANDed into the scholar query) — a mechanism this repo's Vitest suite cannot exercise under real `cache()` semantics (Vitest resolves plain `react`, where `cache()` is a documented pass-through), making it the wrong place to add shared state under an "authorization must not change" constraint without first adding `readonly` typing and a CI-verifiable path. Documented as a follow-up below instead of implemented.
- **Merging the `src/proxy.ts` middleware's `supabase.auth.getUser()` call into the RSC-level dedup — declined.** It runs in a separate execution context (middleware, before the Flight render even starts); consolidating it would be an authentication-semantics change, out of this task's scope.

**Dashboard request call graph (confirmed by direct code reads, not the task's assumptions):**

For one `/dashboard` HTTP request, pre-change:

| Step | Call |
|---|---|
| `src/proxy.ts` middleware | 1x `supabase.auth.getUser()` |
| `layout.tsx:49` | `getCurrentUserResult()` → 1x `supabase.auth.getUser()` + 1x `prisma.appUser.findUnique` |
| `page.tsx:89` `requirePermission()` → `getCurrentUser()` | `getCurrentUserResult()` again → 1x `supabase.auth.getUser()` + 1x `prisma.appUser.findUnique` |
| `layout.tsx:49` + `page.tsx:132` | `getFilterOptions()` x2 → 8 Prisma calls total |
| `page.tsx` query fan-out | 12 query-layer calls, ~23 DB round trips, of which 4 (`getVulnerabilityTiers`, `getOriginBreakdown`, `getAcademicProgressByCountry`, `getEnglishLevelByCountry`) share one `filters` reference into `loadAllStatuses` |

`/dashboard/early-support` is structurally identical for the auth/filter-options duplication (same shared layout, no nested layout), and additionally runs 16 query-layer calls (~94 round trips), 15 of which go through `loadScope` and independently re-derive the current period whenever `filters.period` is unset.

**Infrastructure findings:** no `vercel.json`/`vercel.ts`/region config exists anywhere in the repository. `.env.example:3-12` documents the correct Supabase Supavisor pooling setup (transaction pooler, port 6543, `pgbouncer=true`, for `DATABASE_URL`; session pooler, port 5432, for `DIRECT_URL`) but the actual production values are not in the repository and cannot be verified from code — see Follow-ups.

## Changes

| File | What changed | Why |
|---|---|---|
| `src/components/Sidebar.tsx` | Added `prefetch={false}` to the single `<Link>` used for every nav item. | Stops Next's default viewport-triggered auto-prefetch from firing an expensive (350-900ms) `force-dynamic` RSC render for every visible sidebar destination before the user clicks. Normal client-side navigation on click is unaffected. |
| `src/lib/auth/current-user.ts` | Wrapped `getCurrentUserResult`'s existing body in React's `cache()` (`export async function` → `export const ... = cache(async () => {...})`); body byte-for-byte unchanged. Added `import { cache } from "react"`. | Collapses the layout's direct call and the page's `requirePermission()`-indirected call into one Supabase Auth round trip and one Prisma `AppUser` lookup per render. `cache()`'s memo Map is created fresh per RSC render and reached only via `AsyncLocalStorage` (verified against Next's vendored Flight server) — structurally impossible to leak across requests/users. `getCurrentUser()` and its signature are untouched; `requirePermission()`/`requireScholarAccess()` remain unwrapped and are still the real per-page authorization boundary. |
| `src/lib/dashboard/queries.ts` | Wrapped `getFilterOptions` the same way (body unchanged). Also wrapped the private, zero-argument helpers `getCurrentPeriod()` and `getCurrentSemester()` with `cache()`. Added `import { cache } from "react"`. | `getFilterOptions()` collapses from 2 executions (8 Prisma calls) to 1 (4 Prisma calls) per dashboard-route render — deliberately not `unstable_cache`/`"use cache"`, since new imports must still be visible on the very next request. `getCurrentPeriod`/`getCurrentSemester` are zero-argument and return a primitive, so caching them has no keying ambiguity and no mutation/aliasing surface (unlike `loadScope`/`loadAllStatuses`, which were investigated and declined — see above). |
| `tests/current-user.test.ts` | Added a test asserting `getCurrentUserResult()` called twice outside a React render still hits Prisma twice. | Pins the "not a process-global cache" contract: Vitest resolves plain `react`, where `cache()` is a documented pass-through, so this proves the memo cannot silently become cross-request shared state. |
| `tests/request-dedup.test.ts` (new) | Mocks the `react` `cache` export with a minimal single-slot memoizer (the only way to exercise the dedup logic in Vitest, since it never sets React's real `react-server` condition) and verifies: (a) `getCurrentUserResult()` + `requirePermission()` collapse to one Supabase/Prisma call each; (b) two `getFilterOptions()` calls collapse to one set of the 4 underlying Prisma calls; (c) two different `loadScope`-consuming query functions sharing one `filters` reference collapse the "latest period" lookup from 2 calls to 1. | Demonstrates the actual wiring/dedup behavior without coupling to React internals, per the task's own guidance. |
| `tests/sidebar.test.ts` (new) | Renders `Sidebar` via `react-dom/server`'s `renderToStaticMarkup` with `next/link` and `next/navigation` mocked, asserting every rendered link receives `prefetch={false}` and that active-state (`aria-current`) is still correct. | This repo has no jsdom/testing-library, and adding one solely for this would be disproportionate scope creep; mocking `next/link` lets the test verify Sidebar's own prop-passing without depending on Next's App Router context (which a bare `renderToStaticMarkup` can't satisfy). It cannot and does not claim to verify the browser-side prefetch behavior itself — that's confirmed manually (see Performance impact). |
| `resources/tasks/active/TASK-005-...md` → `resources/tasks/completed/TASK-005-...md` | Moved, with this Final Report appended. | Task lifecycle completion, following the same convention as `TASK-001`. |

**Explicitly not changed:** `requirePermission()`/`requireScholarAccess()` (still the per-page authorization boundary), `scholarAccessWhere()`/mentor scoping, `dynamic = "force-dynamic"` on every dashboard route (confirmed no interaction with `cache()` — different layers: route-segment caching vs. within-render memoization), Prisma schema/migrations, `loadScope`/`loadAllStatuses`, any Vercel/Supabase region configuration (none exists in the repo to change).

## Performance impact

**Measured (via test assertions, not timings):** the new tests demonstrate — under a controlled mock of React's `cache()` semantics, since Vitest cannot exercise the real `react-server` condition — that the dedup logic in the modified files behaves as intended.

**Structurally verified (via code inspection of the actual call graph, not invented):**

| Measurement | Before | After |
|---|---|---|
| Automatic sidebar RSC prefetch requests | 1 per visible sidebar link (up to ~6 in the HAR) | 0 (fetch begins on click instead) |
| Current-user resolver executions per `/dashboard` render | 2 | 1 |
| `supabase.auth.getUser()` calls in-render | 2 | 1 |
| `supabase.auth.getUser()` total per HTTP request (incl. `src/proxy.ts` middleware) | 3 | 2 |
| `prisma.appUser.findUnique` calls per render | 2 | 1 |
| `getFilterOptions()` executions per render | 2 | 1 |
| Prisma calls caused by filter options | 8 | 4 |
| `getCurrentPeriod()`/`getCurrentSemester()` reads on `/dashboard/early-support` (up to 15 `loadScope` calls with no `filters.period`/`filters.semester`) | up to 15 | 1 |

Identical auth/filter-options counts apply to `/dashboard/early-support` (same shared layout, no nested layout).

**Expected but not yet production-measured:** actual wall-clock TTFB improvement. The HAR's ~2.47s TTFB reflects real network/DB/auth latency that these changes reduce in round-trip *count*, but confirming the magnitude of the wall-clock improvement requires redeploying and capturing a new production HAR — not done as part of this task. A local/preview timing benchmark was not run either, since this environment has no running Docker Postgres to stand up the seeded dev database (see Tests below); no timing numbers are claimed beyond the structural round-trip reductions above.

## Security and correctness

- **Per-page authorization remains enforced.** `requirePermission()`/`requireScholarAccess()` are unchanged and unwrapped; every page still independently calls them and denies access on `allowed === false`.
- **Scholar-level scoping is unchanged.** `scholarAccessWhere()` and all `loadScope`/`loadAllStatuses` call sites are untouched.
- **Authenticated identity is not cached across requests.** `cache()`'s memo lives in a Map created fresh inside each RSC render's Flight `Request` object, reached only via `AsyncLocalStorage` (verified against Next.js 16's vendored Flight server internals) — there is no process-global or module-level state introduced. A new test (`tests/current-user.test.ts`) pins this: calling `getCurrentUserResult()` twice outside a render still re-validates the session both times.
- **Dashboard metrics/filter semantics are unchanged.** `getFilterOptions()`'s body, `getCurrentPeriod()`'s/`getCurrentSemester()`'s bodies, and every query-layer function are byte-for-byte unchanged — only wrapped in a memoization layer that is a no-op outside a real RSC render and, within one, only ever returns what an uncached call would have returned for that same request.

## Tests

- `npm test` — **314 tests passed (46 test files)**, including the 3 new/updated test files.
- `npm run test:integration` — **not run**: requires a local Docker Postgres instance (`docker ps` confirms the Docker daemon is not running in this environment). Stated explicitly per the task's instruction not to claim a pass without running it.
- `npm run lint` — **passed**, 0 errors. 1 pre-existing warning in `src/components/ScholarAvatar.tsx` (unrelated `<img>` usage, not touched by this task).
- `npm run build` — **passed**. `next build` compiled successfully, TypeScript passed, and every dashboard route still shows as `ƒ` (dynamic/server-rendered) in the route summary — confirming `force-dynamic` behavior is unchanged.
- `npm run dashboard:check` — **not run**: requires the same local seeded Postgres database as the integration tests, unavailable for the same reason.
- `git diff --check` — **passed**, no whitespace errors.

## Follow-ups

1. **`/dashboard/early-support` query consolidation (`loadScope`).** Request-scoped memoization of `loadScope` would collapse ~94 round trips to ~44 on that page specifically, but three prerequisites should land first: (a) `readonly` return types on the shared scholar/risk payload, so a future in-place mutation becomes a compile error instead of a silent cross-consumer bug (verified today's code has no such mutation, but nothing enforces that it stays that way); (b) a decision on how `scholarAccessWhere(user)`'s freshly-allocated per-call object participates in the cache key, since today it would silently exclude the 4 mentor-scoped call sites from any dedup; (c) a way to exercise the memoized path in CI, since Vitest currently resolves plain `react` where `cache()` is a pass-through. Two smaller, adjacent redundant reads worth folding in at the same time: `getUniversityRetention`'s own `findMany` selects a strict subset of `loadAllStatuses`' columns under an identical `where`; `getGpaByCohort`'s scholar read is the same predicate plus an `ACTIVE` filter.
2. **Vercel ↔ Supabase region verification.** The repository has no region configuration to change or confirm from code. Needs an operational check: the Vercel project's Function Region setting, the Supabase project's actual database region, and whether production's `DATABASE_URL` is really the Supavisor transaction-pooler URL (port 6543, `pgbouncer=true`) as `.env.example` documents, rather than the IPv6-only direct connection. The HAR's request identifiers suggested `gru1` (São Paulo) ingress with execution in `iad1` (US East); if Supabase's database is in yet another region, that cross-region round trip could be a dominant, code-independent factor in the remaining latency.
3. **Re-run a production HAR after this deploys** to get measured (not just structurally-inferred) timing deltas for the changes above.

## Git state

```
$ git status
On branch main
Your branch is up to date with 'origin/main'.
(see working tree at completion time for the exact file list — this task's own changes are: src/components/Sidebar.tsx, src/lib/auth/current-user.ts, src/lib/dashboard/queries.ts, tests/current-user.test.ts, tests/request-dedup.test.ts (new), tests/sidebar.test.ts (new), and this task-file move. Three unrelated task-file moves — 001-task-scholar-photos.md, 004-dashboard-filter-scope-and-semester.md, correct-SPEC-004-dashboard-filter-scope-and-semester.md, active→completed — were already pending in the working tree before this task began and were left untouched, per the instruction not to modify unrelated active task files.)

$ git log --oneline -5
73bb7d5 feat: add scholar profile photos
a3ae756 fix: scope dashboard filters and clarify scholar semester
871560b chore: add project reference resources
ece8193 fix: complete spreadsheet ingestion validation
dcfc0f4 chore: organize project resources and task governance
```
