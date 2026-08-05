# Interface comparison — current dashboard vs. `MVP_Dashboard JULY 2.html`

Compares the live Beca Tech+ dashboard against the design prototype
(`design-reference/MVP_Dashboard JULY 2.html`). The prototype is a **design reference only** — its
hardcoded numbers are illustrative and are never copied into production queries. Each element is
classified: **Implemented** · **Adapt** (reuse the idea via existing components/data) · **Unsupported**
(no data source — keep `Pending`/omit) · **Defer** (needs a business decision) · **Reject**
(conflicts with production architecture/accessibility).

## Home / program overview

| Prototype element | Status | Notes |
|---|---|---|
| Program-health KPI band (active, retention, country split, % women, partner universities) | **Implemented** | real queries; mentors see program-wide aggregates |
| Average GPA KPI | **Implemented (corrected)** | prototype implied one blended `/5`; production reports per-country (`/5`, `/20`) or an Academic Performance Index — never a cross-country blend |
| Satisfaction KPI | **Unsupported** | no approved formula/data — rendered `PROXY`/`Pending`, never fabricated |
| "Data as of" / freshness | **Implemented** | real last-sync freshness badge + paused/stale states (prototype had a static label) |
| Narrative intro band | **Implemented** | |

## Early Support (Years 1–2)

| Prototype element | Status | Notes |
|---|---|---|
| Segmented risk bar + 5-level legend | **Implemented** | |
| Critical + High dark callout | **Implemented** | |
| **Insufficient-data separation** | **Implemented (beyond prototype)** | missing-data scholars are shown separately and excluded from high-risk counts — the prototype did not distinguish this |
| Participation rate, monthly improved/worsened | **Implemented** | uses source-backed activity only |
| Academic-vs-psychosocial alert split | **Implemented** | |
| Drill-down to affected scholars | **Adapt** | risk list exists; a direct in-page link from each band is a small follow-up |

## Career Readiness (Years 3–5)

| Prototype element | Status | Notes |
|---|---|---|
| Pace stat chips + participation | **Implemented** | |
| GPA label | **Implemented (corrected)** | misleading `/5` removed; country-aware |
| Professional-skills KPIs (employability, internships, workshops) | **Unsupported** | no data source — explicit `PENDING` placeholders, not invented |

## Scholar Progress (directory + profile)

| Prototype element | Status | Notes |
|---|---|---|
| Directory with risk + latest GPA | **Implemented** | **server-side scoped** so mentors see only assigned scholars |
| ProfileCard (identity, university, cohort, major, residence, status, activities) | **Implemented** | |
| Current risk / driver / latest report / operator / English level | **Adapt/Partial** | risk (+ "partial" incomplete marker), operator, enrollment now shown; English-level-per-term display pending the `EnglishTracking` decision |
| Source values shown in English | **Implemented** | controlled Spanish→English translation on enrollment/modality/status/risk words |
| Scholar "Age" | **Reject as stored** | derived from `dateOfBirth` at query time, not a stored/fabricated field |

## Program Ecosystem

| Prototype element | Status | Notes |
|---|---|---|
| Partner universities summary | **Implemented** | real `University` data |
| Delivery-partner / operator counts | **Implemented (data now flows)** | `Scholar.operatorId` resolved by name from the sheet; counts are real once synced |
| Early Support vs Growth & Development split | **Implemented** | via `Operator.track` |
| University/operator contact info, satisfaction | **Unsupported** | no data — not displayed |
| Featured scholar story | **Defer** | needs an admin-editable content model |

## Admin

| Prototype element | Status | Notes |
|---|---|---|
| Import batch list + detail | **Implemented** | now with inserted/updated/rejected counts + risk-recompute status |
| Validation errors (row/entity/field/message) | **Implemented** | English messages; entity = source worksheet, rowNumber = source row |
| Data-quality issues list | **Implemented** | severity/status/source; issue metadata for investigation |
| Filters (batch/entity/issue-type/severity/source/status) | **Defer/Partial** | list + labels exist; interactive filter controls are a follow-up |

## Cross-cutting

- **English UI** — Implemented (nav/pages already English; validation + source values now English too).
- **Responsive layout, design tokens** — Implemented; new UI reuses existing components (`KpiCard`,
  `StatChip`, `DarkCallout`, `RiskBadge`, `Donut`, `FreshnessBadge`).
- **Authentication / server-side authorization** — Preserved and strengthened (mentor scoping);
  never bypassed for a prototype layout.
- **No embedded HTML / second dashboard** — the prototype is not served; only its interface ideas
  are adapted into the existing app.
