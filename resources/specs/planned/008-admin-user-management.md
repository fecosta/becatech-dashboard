# SPEC-008 — Admin User Management

**Status:** PLANNED  
**Methodology state:** PRODUCT DECISIONS DEFINED · IMPLEMENTATION REQUIRES AUTHORIZATION ADR  
**Repository baseline:** current `main` as of 2026-09-25  
**Depends on:** Existing Supabase Auth + `AppUser` authorization architecture  
**Architecture dependencies:** ADR-003 — Supabase Auth and AppUser; ADR-004 — Role and Scholar Access Control  
**Required follow-up governance:** New Proposed ADR for user-management authorization behavior

---

# 1. Purpose

Add an administrative user-management interface to the BecaTech+ Scholars Dashboard so authorized administrators can provision and manage dashboard access without manually editing the production database.

The feature must preserve the existing separation between:

- **Supabase Auth**, which establishes user identity through Google sign-in; and
- **`AppUser`**, which controls BecaTech+ dashboard authorization, role, active status, and application access.

The dashboard must not use Supabase Auth accounts themselves as the source of truth for application authorization.

---

# 2. Problem

Dashboard access is currently provisioned through `AppUser` records.

An authenticated Google/Supabase user is only authorized when:

1. their Supabase identity has an email;
2. that email matches an `AppUser.email`;
3. the matching `AppUser` is active.

At present, adding or changing an authorized dashboard user requires a developer or database administrator to:

- edit `prisma/seed-users.ts`;
- run a provisioning script; or
- modify the application database directly.

This creates unnecessary operational dependency and makes routine access management harder for project administrators.

The dashboard needs a secure product workflow for managing these users.

---

# 3. Goals

SPEC-008 introduces an **Admin → Users** area that allows authorized administrators to:

1. view provisioned dashboard users;
2. add a new application user;
3. change a user's application role;
4. activate or deactivate a user;
5. edit the user's display name;
6. identify whether an account is currently active;
7. perform these operations without direct database access.

The feature must preserve existing application authorization behavior.

---

# 4. Non-goals

This specification does **not** authorize:

- replacing Supabase Auth;
- managing Google Workspace accounts;
- creating Google accounts;
- creating passwords;
- managing OAuth providers;
- deleting Supabase Auth identities;
- editing `auth.users` directly;
- storing Supabase Auth UUIDs as the canonical `AppUser.id`;
- changing the existing email-based identity resolution model;
- introducing invitation emails;
- resetting authentication sessions;
- deleting `AppUser` records;
- redesigning the existing role model;
- creating custom roles;
- managing granular permissions per individual user;
- managing mentor-to-scholar assignments in this first version;
- changing scholar-level authorization;
- changing existing dashboard data permissions except where required to introduce user administration.

Mentor scholar assignment management is explicitly deferred.

---

# 5. Existing Identity and Authorization Model

The current architecture is:

```text
Google account
      ↓
Supabase Auth
      ↓
authenticated email
      ↓
AppUser.email
      ↓
AppUser.role + AppUser.isActive
      ↓
dashboard permissions
```

This model remains authoritative.

`AppUser` currently contains:

```prisma
model AppUser {
  id        String   @id @default(cuid())
  fullName  String
  email     String   @unique
  role      UserRole
  isActive  Boolean  @default(true)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

A user may therefore be provisioned in the dashboard before their first Google sign-in.

When that person later signs in through Google using the same email, the existing current-user resolution must recognize the corresponding active `AppUser`.

---

# 6. Core Product Decisions

## D1 — User management operates on `AppUser`

The Admin Users feature manages application users represented by:

`AppUser`

It must not directly manage:

`auth.users`

Supabase Auth remains responsible only for authentication identity.

---

## D2 — Email remains the identity bridge

`AppUser.email` continues to be the bridge between:

- authenticated Supabase identity; and
- application authorization.

This specification does not introduce a persisted Supabase UUID relationship.

The existing ADR-003 identity decision remains unchanged.

---

## D3 — User deletion is not supported

Administrators may deactivate a user but must not delete the `AppUser`.

Deactivation is represented by:

```text
isActive = false
```

This preserves:

- historical references;
- import attribution;
- auditability;
- relational integrity;
- the possibility of restoring access.

The UI must therefore use **Deactivate**, not **Delete**.

---

## D4 — Introduce `MANAGE_USERS`

User administration requires a dedicated application permission:

```ts
MANAGE_USERS
```

It must not reuse:

```ts
MANAGE_DATA
```

or:

```ts
MANAGE_IMPORTS
```

because application authorization management is a distinct security capability.

For this specification:

```text
ANALYST_ADMIN → MANAGE_USERS
```

No other existing role receives this permission.

Because this changes the role-to-permission authorization table, implementation requires an authorization ADR before the code change is considered complete.

---

## D5 — Prevent self-lockout

An administrator must not be able to accidentally remove their own ability to administer the system.

In the MVP, the currently authenticated administrator must not be allowed to:

- deactivate their own account;
- change their own role away from `ANALYST_ADMIN`.

These restrictions must be enforced server-side.

Disabling the corresponding UI controls is useful UX but is not sufficient authorization enforcement.

---

## D6 — Existing email is editable only with explicit safety

Email is the identity bridge used during authentication.

Changing an email therefore has consequences beyond changing a display field.

For the first version:

**Existing users' email addresses are read-only after creation.**

Administrators may edit:

- full name;
- role;
- active status.

If a user's authentication email changes, that should be handled through a future dedicated workflow rather than silently changing the identity key.

---

## D7 — Creating a user does not create an Auth identity

Adding a user through Admin → Users creates an `AppUser`.

It does not create a Supabase Auth account.

Example:

```text
Name:
Juan Guillermo Bedoya

Email:
juanguillermo@velezreyesmas.com

Role:
Analyst / Admin
```

After provisioning, Juan can sign in normally through Google.

If the authenticated Google email is:

```text
juanguillermo@velezreyesmas.com
```

the existing current-user resolution finds the matching active `AppUser`.

---

## D8 — Email uniqueness is mandatory

An administrator cannot create two `AppUser` records with the same email.

The existing database uniqueness constraint remains authoritative.

User-facing validation must return a clear error when the email is already provisioned.

Do not silently create duplicates using alternate capitalization.

Input email must be normalized for comparison using at minimum:

```text
trim whitespace
lowercase
```

Implementation must review compatibility with existing case-sensitive database records before relying only on application normalization.

This specification does not authorize silently rewriting existing production emails.

---

# 7. Navigation

Add a new item under the existing Admin section:

```text
Admin
├── Users
├── Data Imports
└── Data Quality
```

Route:

```text
/dashboard/admin/users
```

The Users navigation item must require:

```text
MANAGE_USERS
```

Currently this means only `ANALYST_ADMIN` users see the link.

Navigation visibility is not an authorization boundary.

The page itself and all mutation endpoints/actions must independently enforce `MANAGE_USERS`.

---

# 8. User List

## 8.1 Required fields

The Users page must show:

- Full Name
- Email
- Role
- Status
- Actions

Status must distinguish:

- Active
- Inactive

---

## 8.2 Ordering

Default ordering:

1. active users first;
2. then alphabetical by full name.

A different deterministic ordering is acceptable if existing application list patterns strongly support it, but ordering must not depend on database insertion order.

---

## 8.3 Empty state

If no application users exist, render a normal empty state.

Do not seed fake users for presentation.

---

# 9. Add User

The page must provide an **Add user** action.

Required fields:

### Full Name

Required.

Trim leading and trailing whitespace.

---

### Email

Required.

Must:

- be syntactically valid;
- be trimmed;
- be normalized for duplicate comparison;
- be unique among `AppUser` records.

The interface should explain that the email must match the email the person will use to authenticate through Google.

---

### Role

Required.

Allowed roles remain the existing `UserRole` values:

```text
EXECUTIVE
PROGRAM_MANAGER
MENTOR
ANALYST_ADMIN
FINANCE
SELECTION_TEAM
```

The UI should display human-readable labels.

Example:

```text
EXECUTIVE        → Executive
PROGRAM_MANAGER  → Program Manager
MENTOR           → Mentor
ANALYST_ADMIN    → Analyst / Admin
FINANCE          → Finance
SELECTION_TEAM   → Selection Team
```

Do not introduce new role semantics in this specification.

---

### Active status

New users are:

```text
Active = true
```

by default.

---

# 10. Edit User

Administrators may modify:

- Full Name
- Role
- Active status

Administrators may not modify the user's email in this first version.

Changes must be persisted server-side.

---

# 11. Deactivate User

A user can be deactivated.

Required behavior:

```text
AppUser.isActive = false
```

Do not delete the row.

After deactivation, subsequent authorization resolution must treat the user as unprovisioned according to the existing authentication architecture.

The implementation does not need to forcibly revoke the user's active Supabase session.

The existing application authorization check must prevent that session from gaining dashboard access on subsequent authorization evaluation.

---

# 12. Reactivate User

An inactive user can be reactivated.

Required behavior:

```text
AppUser.isActive = true
```

The existing role remains unless explicitly changed by the administrator.

---

# 13. Mentor Users

`MENTOR` remains a valid role.

However, mentor authorization additionally depends on `UserScholarAccess`.

Scholar assignment management is not part of SPEC-008.

When a new Mentor is created without scholar assignments:

```text
assignedScholarIds = []
```

Existing authorization behavior must remain:

> a Mentor with zero assignments sees zero scholars.

The application must never interpret an empty assignment list as unrestricted access.

Where useful, the Admin Users interface may show:

```text
No scholars assigned
```

for Mentor users.

It must not introduce an assignment editor as part of this specification.

A separate future specification may define mentor assignment administration.

---

# 14. Authorization

All user-management reads and writes require:

```text
MANAGE_USERS
```

Server-side authorization is mandatory.

At minimum:

```text
/dashboard/admin/users
```

must independently verify permission before rendering protected user data.

Any route handler, server action, or mutation used by the page must independently verify permission before reading or changing application users.

The implementation must not rely on:

- sidebar visibility;
- hidden buttons;
- client-side role checks;
- route obscurity.

---

# 15. Security Requirements

User administration is a privileged operation.

The implementation must satisfy the following:

1. Only users with `MANAGE_USERS` may enumerate application users.
2. Only users with `MANAGE_USERS` may create users.
3. Only users with `MANAGE_USERS` may change roles.
4. Only users with `MANAGE_USERS` may activate or deactivate users.
5. Self-deactivation must be rejected server-side.
6. Removing the current user's own `ANALYST_ADMIN` role must be rejected server-side.
7. Invalid or unknown roles must be rejected server-side.
8. The server must not trust role/status values supplied only through UI controls.
9. Client-side hiding must not substitute for authorization.
10. No Supabase service-role credential may be exposed to the browser.

---

# 16. Data Model

No Prisma schema change is currently required.

Existing fields are sufficient:

```text
AppUser.id
AppUser.fullName
AppUser.email
AppUser.role
AppUser.isActive
AppUser.createdAt
AppUser.updatedAt
```

The feature must use normal Prisma application access.

Do not manually change the production database schema.

If implementation discovers that the existing schema is insufficient, work must stop and the required schema change must be separately reviewed before introducing a migration.

---

# 17. Provisioning Script

`prisma/seed-users.ts` currently provisions known application users.

After SPEC-008, the production Admin Users interface becomes the primary operational mechanism for routine user provisioning.

The seed script may continue to exist for:

- bootstrap administrators;
- development;
- disaster recovery;
- explicitly managed system identities such as the Sheets sync account.

The application must not require every user created through the Admin UI to be manually added to `seed-users.ts`.

Running `db:seed:users` must not delete or deactivate users created through the Admin UI.

---

# 18. UI / UX

The feature must follow the existing dashboard design system.

Prefer existing:

- page headers;
- tables;
- form controls;
- badges;
- dialogs/modals if already established;
- buttons;
- spacing;
- typography;
- focus states;
- responsive patterns.

Do not create an isolated visual system specifically for user administration.

The page should prioritize operational clarity over decorative presentation.

---

# 19. Confirmation Behavior

Potentially disruptive actions should require clear confirmation.

At minimum:

### Deactivate user

Confirmation should communicate that the person will lose dashboard access.

Example intent:

```text
Deactivate Juan Guillermo Bedoya?

This user will no longer be able to access the BecaTech+ dashboard.
Their account and historical records will be preserved.
```

### Role change

A role change should clearly expose the new role before saving.

A separate confirmation modal is optional if the edit workflow itself clearly presents the changed role and save action.

---

# 20. Error Handling

The UI must provide understandable errors for at least:

- duplicate email;
- invalid email;
- missing name;
- invalid role;
- unauthorized operation;
- self-deactivation attempt;
- self-demotion attempt;
- target user no longer existing;
- unexpected persistence failure.

Do not expose database internals or stack traces to users.

---

# 21. Concurrent Changes

User-management mutations must safely handle the possibility that another administrator changed the same user.

At minimum:

- mutations must target the user by stable `AppUser.id`;
- the server must verify the target still exists;
- the UI must not pretend an update succeeded when zero rows were affected or persistence failed.

Full optimistic-locking infrastructure is not required for the MVP.

---

# 22. Accessibility

The Users interface must preserve the application's accessibility expectations.

Required:

- keyboard-accessible controls;
- visible focus treatment;
- form labels;
- status communicated by text, not color alone;
- accessible validation messages;
- meaningful action labels;
- confirmation dialogs with keyboard-operable controls.

---

# 23. Auditability

The current schema records:

```text
createdAt
updatedAt
```

but does not record:

```text
who performed each administrative change
```

Full administrative audit logging is not part of this MVP.

The system must not claim administrator-level change attribution when it does not exist.

A future specification may introduce explicit authorization audit events.

No new audit table is required by SPEC-008.

---

# 24. Acceptance Criteria

SPEC-008 is accepted when all of the following are true.

## Navigation and access

- Admin → Users exists.
- Only users with `MANAGE_USERS` see the navigation item.
- Direct access without `MANAGE_USERS` is rejected server-side.
- `ANALYST_ADMIN` has `MANAGE_USERS`.
- No other existing role gains `MANAGE_USERS`.

## List

- Provisioned `AppUser` records are listed.
- Name, email, role, and active status are visible.
- Inactive users remain visible.

## Create

- An administrator can create a new application user.
- Full name is required.
- Valid email is required.
- Role is required.
- New users are active by default.
- Duplicate emails are rejected.
- Creation does not require an existing Supabase Auth record.
- Creation does not manipulate `auth.users`.

## Edit

- Full name can be changed.
- Role can be changed.
- Active status can be changed.
- Existing email cannot be edited.

## Deactivation

- Deactivation sets `isActive = false`.
- The `AppUser` record is preserved.
- Historical references remain intact.
- A deactivated user is denied application access by the existing current-user authorization flow.

## Reactivation

- An inactive user can be restored with `isActive = true`.

## Self-protection

- An administrator cannot deactivate themselves.
- An administrator cannot remove their own `ANALYST_ADMIN` role.
- Both rules are enforced server-side.

## Mentor safety

- Creating a Mentor without scholar assignments does not grant unrestricted scholar access.
- Existing empty-assignment behavior remains zero visible scholars.

## Security

- Every user-management mutation checks `MANAGE_USERS` server-side.
- Navigation visibility is not used as the authorization boundary.
- No Supabase privileged secret is exposed client-side.

---

# 25. Testing Requirements

Implementation must include focused automated tests.

## Authorization tests

Test:

- `ANALYST_ADMIN` receives `MANAGE_USERS`;
- every other role does not;
- unauthorized access to user-management operations is rejected.

---

## User creation tests

Test:

- valid user creation;
- duplicate email rejection;
- invalid role rejection;
- default active state;
- normalized email comparison where applicable.

---

## User update tests

Test:

- name change;
- role change;
- deactivation;
- reactivation;
- attempted email mutation rejected or unsupported.

---

## Self-protection tests

Test:

- current administrator cannot deactivate themselves;
- current administrator cannot demote themselves.

These must be server-side tests, not only component tests.

---

## Existing authorization regression tests

Confirm:

- existing role permissions remain unchanged except addition of `MANAGE_USERS` to `ANALYST_ADMIN`;
- Mentor scholar scoping remains intact;
- inactive users remain unprovisioned;
- current-user resolution still uses authenticated email → `AppUser`.

---

# 26. Validation

At implementation completion, run the applicable repository checks:

```bash
npm run lint
npx tsc --noEmit
npm test
npm run build
git diff --check
```

Because the feature performs Prisma-backed persistence operations, also run:

```bash
npm run test:integration
```

when available in the implementation environment.

Do not claim any validation passed unless it was actually executed successfully.

---

# 27. Documentation Impact

Implementation must update as applicable:

```text
docs/SECURITY.md
docs/ARCHITECTURE.md
docs/PRODUCT.md
docs/adr/
resources/specs/README.md
```

`docs/SECURITY.md` must document:

- `MANAGE_USERS`;
- which role owns it;
- Admin Users server-side enforcement;
- self-lockout protections;
- continued Supabase Auth / `AppUser` separation.

---

# 28. Architecture Governance

This specification preserves ADR-003:

> Supabase Auth establishes identity; `AppUser` establishes dashboard authorization.

However, it changes the authorization capability model by introducing:

```text
MANAGE_USERS
```

and gives administrators the ability to mutate authorization records through the application.

ADR-004 explicitly requires a new ADR when changing the role/permission table.

Therefore implementation must include a new **Proposed authorization ADR** covering at least:

- `MANAGE_USERS`;
- `ANALYST_ADMIN` ownership of that permission;
- server-side enforcement;
- self-deactivation protection;
- self-demotion protection;
- the decision not to manipulate Supabase Auth identities;
- deactivation rather than deletion.

The ADR should become Accepted only after the decision is approved and implemented according to repository governance.

---

# 29. Deferred Follow-ups

The following capabilities are intentionally deferred:

### Mentor assignment management

Manage:

```text
UserScholarAccess
```

through the Admin interface.

---

### Administrative audit history

Record:

```text
actor
action
target user
before state
after state
timestamp
```

for authorization changes.

---

### Email identity change

Safely migrate an existing `AppUser` from one login email to another.

---

### Auth-account visibility

Optionally show whether an `AppUser` has ever authenticated through Supabase.

This would require careful review because `AppUser` currently does not maintain a direct Supabase identity relationship.

---

### Invitations

Send onboarding/invitation messages when a user is provisioned.

---

# 30. Definition of Done

SPEC-008 is complete when:

- the Admin Users workflow is implemented;
- `MANAGE_USERS` is implemented and server-side enforced;
- the authorization ADR is approved and reflects implemented behavior;
- administrators can create and manage `AppUser` access without database intervention;
- users are deactivated rather than deleted;
- self-lockout protections are enforced;
- Supabase Auth remains separate from application authorization;
- mentor scholar-access behavior is unchanged;
- tests cover privileged mutations and authorization boundaries;
- applicable validation passes;
- security and architecture documentation reflects the final implementation.