# ADR-001 — Canonical Scholar Identifier

Status: Accepted
Date: 2026-09-01 (documenting an already-established decision; the identifier has been in place
since the schema's initial migration, `20260702230709_init`)

## Context

The program's source datasets identify scholars using `ID_becario`. Longitudinal program
information arrives from multiple sources (the Google Sheets sync pipeline, manual admin
imports, and a placeholder JotForm path) and must consistently refer to the same scholar across
all of them, across time.

Using mutable or non-unique attributes such as name, email, phone number, or university would
make cross-source linking unreliable — names collide, contact details change, and a scholar can
move between universities/operators over their program.

## Decision

`ID_becario` is represented in the application as:

```prisma
model Scholar {
  scholarId String @id // maps to ID_becario
  ...
}
```

`scholarId` is the canonical scholar identifier across the application. Every longitudinal
entity (`AcademicTerm`, `MonthlyCheckin`, `MentorReport`, `SupportActivity`, `ScholarRequest`,
`RiskAssessment`, `FinancialInput`, `UserScholarAccess`, `SelectionCandidate`) references a
scholar through this identifier, never a surrogate id.

It is also the identifier used in the URL for a scholar's profile
(`/dashboard/scholars/[scholarId]`) and in mentor scholar-access scoping
(`UserScholarAccess.scholarId`, `CurrentUser.assignedScholarIds`).

## Consequences

- Imports must preserve `ID_becario` exactly — `src/lib/data-import`'s adapters resolve incoming
  rows to a `scholarId`, never generate one.
- Integrations must map source scholar identity to `scholarId` before writing any child record.
- URLs may safely use `scholarId` where current routing does so (the scholar-profile route does).
- Business logic must not introduce another canonical scholar identity (e.g. keying anything by
  email or a database-generated id).
- Identity changes require explicit migration planning, not a silent rename.

## Change Policy

Changing the canonical identifier requires a new ADR and a documented data migration strategy.
