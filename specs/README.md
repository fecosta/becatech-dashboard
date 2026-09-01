# Feature Specifications

Feature specs define product behavior before or alongside implementation.

## Lifecycle

### planned
Approved or proposed work that has not started.

### active
Currently being implemented.

### completed
Implemented behavior retained for historical and maintenance context.

## Naming

Use:

```
NNN-short-feature-name.md
```

Example: `002-program-ecosystem-universities.md`

## Required Sections

Each feature spec should normally contain:

- Status
- Goal
- Context
- User Workflow
- Requirements
- Non-Goals
- Data Considerations
- Authorization / Security
- Acceptance Criteria
- Testing
- Documentation Impact

## Rule

Specs describe intended behavior. Architecture belongs in ADRs (`docs/adr/`). Implementation
details belong in code unless they are necessary constraints.
