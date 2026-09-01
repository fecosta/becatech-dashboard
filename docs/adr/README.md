# Architecture Decision Records

Architecture Decision Records document significant technical or data architecture decisions.

## Statuses

- **Proposed** — a decision under consideration, not yet established in the codebase.
- **Accepted** — the decision is already implemented and clearly established, or has documented
  human approval.
- **Superseded** — replaced by a later ADR (link to it).
- **Deprecated** — no longer in effect, without a direct replacement.

An ADR should only be marked `Accepted` when the decision is already implemented and clearly
established, or when explicit human approval is documented.

## ADR Format

Each ADR should contain:

```md
# ADR-NNN — Title

Status: Accepted | Proposed | Superseded | Deprecated
Date: YYYY-MM-DD

## Context

What problem or constraint required a decision?

## Decision

What decision was made?

## Consequences

What becomes easier, harder, required, or prohibited?

## Alternatives Considered

Only include alternatives when supported by repository history or documented context.
```

Do not invent fake decision meetings or approvals. When no alternative is documented anywhere in
the repository (commits, comments, prior docs), omit the "Alternatives Considered" section rather
than fabricate one.

## Index

| ADR | Title | Status |
|---|---|---|
| [001](001-canonical-scholar-identifier.md) | Canonical Scholar Identifier | Accepted |
| [002](002-normalized-postgresql-model.md) | Normalized PostgreSQL Model | Accepted |
| [003](003-supabase-auth-and-app-user.md) | Supabase Auth and AppUser | Accepted |
| [004](004-role-and-scholar-access-control.md) | Role and Scholar Access Control | Accepted |
| [005](005-prisma-migrations.md) | Prisma Migrations | Accepted |
| [006](006-authoritative-monthly-risk.md) | Authoritative Monthly Risk Source | Accepted |
