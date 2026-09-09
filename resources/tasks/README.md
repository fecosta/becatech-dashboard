# Implementation Tasks

This directory stores concrete engineering execution tasks for AI-assisted development.

Tasks are execution artifacts, not product requirements:

- **Specs** define what the product/system should do and why.
- **Tasks** define a concrete implementation, validation, review, or migration assignment.
- **ADRs** record architectural decisions.
- **PRs/code** contain the actual implementation.

A single spec may be implemented through multiple tasks. Task numbering is independent from spec numbering.

## Lifecycle

```text
planned -> active -> completed
```

- `planned/`: identified work that is not currently being executed.
- `active/`: the current implementation assignment(s).
- `completed/`: historical tasks retained for implementation context and traceability.

## Recommended task header

```markdown
# TASK-### — Short title

Status: Planned | Active | Completed
Owner: Engineering
Related spec: SPEC-### | None
Related ADRs: ADR-###, ADR-### | None
Created: YYYY-MM-DD
Completed: YYYY-MM-DD | —

## Objective
...
```

## Rules

- Keep each task narrow and independently reviewable.
- Reference the owning spec/ADR instead of duplicating their decisions.
- Do not use a task to silently introduce new product behavior that requires a spec.
- Do not use a task to silently introduce an architecture decision that requires an ADR.
- Preserve the final implementation prompt and validation requirements when they are useful for future maintenance.
- Move a task to `completed/` after its implementation is merged or otherwise formally completed.
- A completed task does not automatically mean its related spec is complete; spec acceptance criteria must be independently satisfied.
