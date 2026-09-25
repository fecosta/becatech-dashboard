# ADR-010 — Admin User Management Authorization

Status: Proposed  
Date: 2026-09-25

## Context

The BecaTech+ Scholars Dashboard separates authentication from application authorization.

Supabase Auth establishes the identity of a signed-in user through Google authentication. The application then resolves the authenticated email against an active `AppUser` record to determine whether the person may access the dashboard and which application role they hold.

This architecture is established by:

- ADR-003 — Supabase Auth and AppUser;
- ADR-004 — Role and Scholar Access Control.

Application users currently have one of six roles:

- `EXECUTIVE`
- `PROGRAM_MANAGER`
- `MENTOR`
- `ANALYST_ADMIN`
- `FINANCE`
- `SELECTION_TEAM`

Permissions are assigned to roles in `src/lib/auth/authorization.ts`, and protected pages and mutations enforce those permissions server-side.

Provisioning and changing `AppUser` records currently requires developer or database intervention.

SPEC-008 — Admin User Management introduces an application workflow allowing authorized administrators to:

- list application users;
- create new `AppUser` records;
- change user roles;
- activate users;
- deactivate users;
- edit display names.

This introduces a new security-sensitive capability: an application user can change the authorization state of another application user.

ADR-004 requires a new architectural decision when the role/permission model changes.

The implementation therefore needs an explicit decision defining:

- who may administer users;
- how that capability is represented;
- which identity system is affected;
- how self-lockout is prevented;
- whether users are deleted or deactivated;
- where authorization enforcement occurs.

---

## Decision

### 1. Introduce a dedicated `MANAGE_USERS` permission

The application permission model will add:

```ts
MANAGE_USERS
```

User administration is a distinct security capability and must not reuse unrelated permissions such as:

```ts
MANAGE_DATA
MANAGE_IMPORTS
```

`MANAGE_USERS` controls access to application-user administration.

---

### 2. `ANALYST_ADMIN` is the only existing role granted `MANAGE_USERS`

The role-permission table will be extended so that:

```text
ANALYST_ADMIN → MANAGE_USERS
```

No other existing role receives this permission.

Existing permissions assigned to all roles otherwise remain unchanged.

This decision does not introduce new roles or custom per-user permission sets.

---

### 3. User management operates only on `AppUser`

The Admin User Management feature manages:

```text
AppUser
```

It does not manage Supabase Auth identities.

The existing separation remains:

```text
Google
  ↓
Supabase Auth
  ↓ authenticated email
AppUser
  ↓
role + active status
  ↓
application authorization
```

Creating an `AppUser` does not:

- create a Supabase Auth user;
- create a Google account;
- invite a Google user;
- modify `auth.users`;
- set a password;
- link or persist a Supabase Auth UUID.

A person may therefore be provisioned in `AppUser` before their first login.

When the person later authenticates with the same email through Google, the existing email-based resolution established by ADR-003 continues to apply.

---

### 4. Email remains the identity bridge

`AppUser.email` remains the application-side identifier used to resolve an authenticated Supabase user to application authorization.

SPEC-008 does not introduce a persisted relationship between:

```text
auth.users.id
```

and:

```text
AppUser.id
```

Existing `AppUser` email addresses are not editable through the first Admin User Management implementation.

Changing an existing authentication email requires a separate explicitly designed workflow because email currently participates in identity resolution rather than serving only as profile data.

---

### 5. Application users are deactivated, not deleted

Routine access removal will use:

```text
AppUser.isActive = false
```

The Admin User Management interface will not delete `AppUser` records.

Deactivation preserves:

- relational references;
- historical attribution;
- import ownership;
- administrative history represented by existing records;
- the ability to restore access.

An inactive `AppUser` continues to behave according to ADR-003: even when a valid Supabase session exists, the application resolves the person as unprovisioned.

Reactivation restores:

```text
AppUser.isActive = true
```

without creating a new application identity.

---

### 6. Self-lockout is prohibited

A user with `MANAGE_USERS` must not be able to accidentally remove their own administrative access through the Admin User Management workflow.

The currently authenticated administrator must not be allowed to:

```text
deactivate their own AppUser
```

or:

```text
change their own role from ANALYST_ADMIN to another role
```

These protections must be enforced server-side.

Disabling controls in the user interface may supplement the rule but is not an authorization boundary.

This decision protects against accidental self-lockout through the supported application workflow.

It does not attempt to prevent:

- direct database administration;
- deployment-time configuration changes;
- provisioning-script changes;
- another authorized administrator from changing the first administrator.

---

### 7. User-management authorization is enforced server-side

Every user-management operation must independently require:

```text
MANAGE_USERS
```

This includes, at minimum:

- listing application users;
- creating an application user;
- changing a user's display name;
- changing a user's role;
- deactivating a user;
- reactivating a user.

The Admin → Users navigation entry may be hidden from unauthorized users for usability, but navigation visibility is not an authorization control.

The `/dashboard/admin/users` page must enforce authorization independently.

Any route handler, server action, or other mutation boundary used by the feature must also enforce authorization independently.

This extends, rather than replaces, the enforcement model established by ADR-004.

---

### 8. User mutations target `AppUser.id`

Once a user exists, administrative mutations must target the stable:

```text
AppUser.id
```

rather than treating mutable display data as the update key.

Email remains the authentication-resolution bridge, but update/delete-style operations must not identify the target merely by:

- full name;
- role;
- client-provided row position;
- another mutable presentation value.

The server must confirm the target user still exists before reporting a successful mutation.

---

### 9. New application users use normalized email input

New `AppUser` provisioning must normalize email input at minimum by:

```text
trim
lowercase
```

before persistence.

Duplicate application users must not be intentionally created through capitalization or whitespace variations.

The existing database uniqueness constraint remains authoritative for persisted uniqueness.

Because historical `AppUser` records may predate this normalization rule, implementation must inspect existing records and handle conflicts explicitly rather than silently rewriting production identities.

No database migration is authorized by this ADR solely for email normalization.

---

### 10. Mentor scholar assignments remain separate

Creating or editing an `AppUser` with:

```text
role = MENTOR
```

does not grant scholar access by itself.

Existing `UserScholarAccess` behavior remains unchanged.

A Mentor with zero scholar assignments must continue to see zero scholars.

Admin User Management does not introduce mentor assignment editing.

That capability requires separate product scope and security review.

---

### 11. Routine provisioning moves into the application

Once SPEC-008 is implemented, Admin → Users becomes the normal operational mechanism for adding and maintaining human dashboard users.

`prisma/seed-users.ts` may continue to support:

- bootstrap administrators;
- development environments;
- disaster recovery;
- explicitly managed system identities.

Running the provisioning seed must not remove or deactivate legitimate users that were created through the Admin interface.

The Admin User Management feature does not require every UI-created user to also be committed to `seed-users.ts`.

---

### 12. No new Prisma schema is required for the initial implementation

The existing `AppUser` fields are sufficient for the initial capability:

```text
id
fullName
email
role
isActive
createdAt
updatedAt
```

No schema migration is required by this decision.

If implementation discovers a persistence requirement not supported by the existing model, that requirement must be reviewed separately before introducing a migration.

In particular, this ADR does not authorize adding:

- Supabase user IDs;
- audit-event tables;
- invitation state;
- per-user permission arrays;
- authentication metadata.

---

### 13. Administrative audit logging is deferred

The current `AppUser` model records:

```text
createdAt
updatedAt
```

but does not record which administrator made each authorization change.

SPEC-008 does not introduce a dedicated authorization audit log.

The application must therefore not claim actor-level auditability that does not exist.

A future security or governance requirement may introduce explicit records containing:

```text
actor
action
target
previous state
new state
timestamp
```

That would require separate persistence and security review.

---

## Consequences

### Positive

Administrators can perform routine application-user provisioning without:

- direct production database access;
- one-off SQL;
- developer intervention;
- editing seed files for every new human user.

The authorization model remains explicit:

```text
authentication → Supabase Auth
authorization → AppUser
```

A dedicated `MANAGE_USERS` permission makes authorization administration distinguishable from data administration and import administration.

Self-lockout protection reduces the likelihood that an administrator accidentally removes their own access.

Deactivation preserves application identity and historical references.

No new database schema or Supabase Auth integration is necessary for the initial implementation.

---

### Security consequences

`ANALYST_ADMIN` becomes able to change other users' application authorization.

Compromise of an `ANALYST_ADMIN` account therefore carries additional impact after this capability is introduced.

For that reason:

- `MANAGE_USERS` must remain restricted;
- every operation must be server-authorized;
- user-supplied role values must be validated server-side;
- self-protection rules must be server-enforced;
- client-side visibility must never be treated as security;
- Supabase service-role credentials must not be required or exposed for this feature.

---

### Operational consequences

Provisioning an `AppUser` does not guarantee that the person can authenticate.

The person must still authenticate successfully through the configured Google/Supabase authentication flow using the email provisioned in `AppUser`.

Likewise, removing or changing a Supabase Auth account does not automatically alter the corresponding `AppUser`.

This is an intentional consequence of retaining the identity/authorization separation established by ADR-003.

---

### Development consequences

Implementation of SPEC-008 must update the permission model and corresponding tests.

At minimum, tests must establish that:

- `ANALYST_ADMIN` has `MANAGE_USERS`;
- every other current role does not;
- unauthorized user-management requests fail server-side;
- an administrator cannot deactivate themselves;
- an administrator cannot demote themselves;
- deactivation preserves the `AppUser` record;
- inactive users remain unauthorized through the existing current-user flow;
- Mentor scholar scoping remains unchanged.

Relevant security documentation must be updated to reflect the new capability.

---

## Relationship to Existing ADRs

### ADR-003 — Supabase Auth and AppUser

Unchanged.

Supabase Auth remains responsible for identity and `AppUser` remains responsible for application authorization.

This ADR extends the operational management of `AppUser`; it does not replace the identity model.

### ADR-004 — Role and Scholar Access Control

Extended.

ADR-004 defines the role-to-permission model and server-side enforcement pattern.

This ADR adds:

```text
MANAGE_USERS
```

to that model and assigns it exclusively to `ANALYST_ADMIN`.

Existing scholar-level access behavior remains unchanged.

---

## Alternatives Considered

### Reuse `MANAGE_DATA`

Rejected because program-data administration and authorization administration are different security capabilities.

Granting access to imports or data maintenance should not implicitly grant the ability to change who may access the system.

### Manage Supabase Auth users directly

Rejected for SPEC-008 because it would merge authentication administration with application authorization and require privileged Supabase Auth administration capabilities.

The existing architecture deliberately uses `AppUser` as the source of application authorization.

### Delete users instead of deactivating them

Rejected because `AppUser` participates in application relationships and historical attribution.

Deactivation preserves referential and operational history while still removing access.

### Allow administrators to demote or deactivate themselves

Rejected for the initial implementation because it creates an avoidable self-lockout path through routine UI operations.

More advanced administrator-governance workflows may revisit this in the future.