# Reference-Data Audit — Beca Tech source worksheets

Audit of the two operational Google Sheet tabs that feed the dashboard sync
(`SCHOLAR GENERAL INFO`, `MENTOR REPORTS`) and the anonymized reference exports under
`context/data/`. Uses anonymized/structural examples only — no personal or row-level scholar data.

Companion documents: the canonical field dictionary and per-entity contract live in
[`sync-contract.md`](./sync-contract.md).

## 1. Anonymization limitations of the reference exports

The two CSVs in `context/data/` were anonymized **only for sharing with AI tools**. Consequences
the pipeline design must not "fix":

- **Single-row header + PII stripped.** `Anonymized Export - 1- … SCHOLAR GENERAL INFO.csv` has one
  header row (field names) and data from row 2 — it is **not** a faithful mirror of the live sheet's
  two-row header (below). Names/emails/phones/DOB are replaced with tokens (`SCHOLAR-…`,
  `Scholar-…`, `Mentor-…`, age as a `RANGE`, dates as `MONTH`).
- **IDs do not cross-join between the two files.** Anonymization generated different scholar tokens
  in each export. In production, `SCHOLAR GENERAL INFO.ID` and the mentor-report scholar identity
  refer to the same scholar; do not infer identity across the anonymized files.

## 2. `SCHOLAR GENERAL INFO` — two-row header (live sheet)

The **live** sheet has two header rows: **row 1 = category**, **row 2 = field**, data from row 3.
The logical field identity is `category + field` because some field labels repeat.

Categories (in order): `BASIC DATA` → `ACOMPAÑAMIENTO ACTUAL` → `MATRÍCULA` → `AVANCE ESTUDIOS`
→ `GPA` → `INGLÉS` → `INFORMATIVO`.

`Normalize.gs` handles this by **dynamically locating the field-header row** (scanning the first
~20 rows for a row that has an ID column + at least one `GPA <term>` column); any category row
above it is skipped, so the category row is never treated as data. Column matching is by normalized
header **text** (accent/case/whitespace-insensitive), never by fixed position, so added semesters
are picked up automatically.

### Semester (per-term) field patterns

Detected dynamically by regex on the term suffix `(\d{4}-\d)` — no per-semester hardcoding:

| Field | Header pattern (bilingual) | Canonical |
|---|---|---|
| GPA | `GPA 2026-1` | `AcademicTerm.gpa` for that term |
| Credits | `Credits 2026-1` / `Créditos 2026-1` | `AcademicTerm.creditsEnrolled` |
| Enrollment | `Enrollment Status 2026-1` / `Estado matrícula 2026-1` | `AcademicTerm.enrollmentStatus` |
| Failed count | `MATERIAS REPROBADAS/CANCELADAS 2026-1` | `AcademicTerm.failedSubjectsCount` |
| Failed detail | `MENCIONAR LAS ASIGNATURAS 2026-1` | `AcademicTerm.failedSubjectsDetail` |

**Term text is preserved as plain text** (`2026-1`), never coerced to a date — `Normalize.gs`
forces the `term` column to Plain Text format *before* writing (Sheets would otherwise turn
`"2024-1"` into a real Date on write). Malformed term suffixes simply don't match the regex.

### Duplicate / ambiguous headers

- **`ESTADO FINAL` repeats once per term block with no term in its own text.** For most terms it's an
  unambiguous 3-column block (`MATERIAS REPROBADAS → MENCIONAR → ESTADO FINAL`) and is resolved
  **positionally** to `AcademicTerm.academicStatus`. For 2025-1/2025-2 the sheet stacks two
  `MATERIAS/MENCIONAR` pairs before a single `ESTADO FINAL`, which is genuinely ambiguous — that
  column is **left unresolved** (never guessed), documented in `Normalize.gs`'s unmapped list.

### Source-language considerations

Values are Spanish (anonymized examples): status `BECARIO(A) ACTIVO`, gender `Masculino`,
enrollment `MATRICULADO(A)`. Enum-like values are mapped to canonical enums at normalization
(`mapStatus`, `mapCountry`) or translated for display (`lib/display/source-values.ts`); unknown
values are shown raw, never silently defaulted.

### Fields available vs. missing

- **Available and synced today:** ID, country, cohort, status, university, program, current
  semester, name, start date, operator, gender, ethnic group, origin/residence department &
  municipality, socioeconomic level, and the per-term GPA/credits/enrollment/failed fields — plus
  the extended profile fields (`estimatedGraduationYear`, `programDurationYears`,
  `highSchoolGraduationYear`, parents' education, emails, DOB, mobile phone).
- **Present in source but intentionally unmapped** (see `Normalize.gs` unmapped list): single-value
  academic-summary columns whose target is per-term (`Total Credits`, `Cumulative - Credits`,
  `Overdue Courses`, `Academic Progress`, `Cumulative GPA`, `ACUMULADO`); the English-tracking block
  (needs an `EnglishTracking` model decision); selection/financial-looking columns (`LB: ACADÉMICO`,
  `ICFES COL`, `SISBEN COL`, `Nivel económico (Perú)`, `NIVEL DE PRIORIZACIÓN`, `MONTO`,
  `PUNTAJE SELECCIÓN`, `OBSERVACIÓN`); and `Age` (dropped — derive from `dateOfBirth`).
- **Missing from source entirely:** satisfaction survey, professional-skills scores (the `MAKERS`
  and `CONFIDENT ENGLISH` columns exist but are entirely empty), dropout-reason taxonomy, university
  and operator contacts — kept `Pending`/`Not Available` in the UI, never fabricated.
- **Correction (AUGUST 4 pass):** the *risk-reason* taxonomy is **not** missing. The two
  "¿Qué situación específica está presentando el becario?" columns on MENTOR REPORTS are synced to
  `MentorReport.academicAlertType` / `psychosocialAlertType` and are fully populated with a closed
  list — 21 academic and 16 psychosocial options. They are grouped in `lib/risk/reason-taxonomy.ts`.
  (`ACADEMIC CAUSE` / `PSYCHOSOCIAL CAUSE`, listed as unmapped, are a different pair of columns and
  are blank in the reference export.) This is distinct from the *drop-out* reason, which genuinely
  has no source.

### Fields requiring controlled mappings

`Current Operator - Support Services` → resolved to an `Operator` by name (unknown = data-quality
error, never auto-created). Enrollment/modality/risk-word/check-in-status → `lib/display/source-values.ts`.
Socioeconomic — the raw `SISBEN COL` / `Nivel económico (Perú)` columns remain country-specific and
must not be merged into one numeric scale. **Correction (AUGUST 4 pass):** the separate
`Socioeconomic Level` column already carries a single harmonised scale for both countries
(`Vulnerabilidad alta / moderada / baja`), so the cross-country reconciliation is done upstream and
is not an open decision. What is still open is the *tier naming* the design proposes — see
`lib/scholars/socioeconomic-tier.ts`. Roughly a fifth of scholars are marked `Pending` there and
never receive a tier.

## 3. `MENTOR REPORTS` — flat, one row per mentor session

Single flat header (no category row); one row per Jotform submission; `Submission ID` present.

- **`ID OF THE SCHOLAR` and `MENTOR ID` are distinct columns.** The scholar identity is
  `ID OF THE SCHOLAR` (a real scholar ID on the new sheet); `MENTOR ID` is the mentor's own ID and
  is intentionally unmapped (no `Mentor` model yet). Identity resolution prefers the direct scholar
  ID, cross-checks it against `SCHOLAR'S NAME`, and rejects a disagreement rather than guessing.
- **Monthly history is preserved** — reports are not collapsed; latest status is derived separately.
- **Blank ≠ zero (critical).** Activity-count cells that are **blank** mean "no support-activity
  rows for that period" = *not assessed*; a present `0` means the month happened and nothing was
  attended = a real zero. The risk engine relies on this distinction (missing participation data is
  never inferred as CRITICO — see `lib/risk/derive.ts` / `recompute.ts`).
- **Reporting period columns:** `SEMESTER` (`2026-1`), `MONTH` (`MES 1`), `¿Qué mes reportas?` — the
  last feeds `reportingMonth`; the bare `MONTH`/`DATE` columns are left unmapped pending owner
  clarification.
- **`GLOBAL STATUS`** (mentor's self-reported overall assessment) is stored as
  `mentorReportedGlobalStatus` but **quarantined** — never fed into the derived risk engine.

## 4. HTML prototype (`design-reference/MVP_Dashboard JULY 2.html`)

- **Supported by data:** active/withdrawn/graduated counts, retention, country split, % women,
  partner-university count, risk segmentation, per-country GPA, cohort/university breakdowns,
  scholar directory, operator/university summaries, data-freshness indicator.
- **Not supported (kept `Pending`/removed, never fabricated):** satisfaction survey score,
  professional-skills / employability / placement metrics, dropout-reason taxonomy, university
  contact info. Any hardcoded number in the HTML is illustrative and is not copied into queries.
