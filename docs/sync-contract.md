# Canonical Sync Contract & Field Dictionary

The canonical English data contract for the Google Sheets → dashboard sync, per entity. Source
worksheets may be Spanish; canonical field names and all user-facing output are English.

Pipeline: `apps-script/Normalize.gs` (reads messy tabs, writes hidden `NORMALIZED_*` tabs) →
`apps-script/Sync.gs` (CSV POST with `x-entity`) → `/api/sync/import` → `templateAdapter` →
`validateBatch` (`src/lib/data-import/validate.ts`) → `commit.ts` (bulk upsert) →
`runDataQualityScan` → `recomputeRiskForScholars`. The typed field list is
`TEMPLATE_COLUMNS` in `src/lib/data-import/templates.ts`; see also
[`reference-data-audit.md`](./reference-data-audit.md).

## Cross-cutting rules

- **Normalization** (`Normalize.gs`): header matching is accent/case/whitespace-insensitive and
  **bilingual** (old Spanish + new English headers). Per-term columns are matched by regex on the
  `YYYY-N` suffix. `term` and `scholarId` are forced to Plain Text before writing (anti
  date-coercion).
- **Translation of values**: enum-like Spanish values map to canonical enums at normalization
  (`mapCountry`, `mapStatus`); free-text display values use `lib/display/source-values.ts`. An
  unknown value is surfaced (raw), never silently defaulted.
- **Validation**: messages are English (`validate.ts`). Unresolvable identity/university/operator =
  a visible row error in `DataImportBatch.errorReport`, never a guess.
- **Idempotency**: rows upsert by a natural key (below). A synthetic `submissionId` is derived only
  when the source supplies none.
- **Sensitivity**: fields marked *sensitive* are personal data (names, emails, phone, DOB). They are
  never written to docs or logs; the anonymized reference exports tokenize them.

## SCHOLAR → `Scholar`

Source worksheet: `SCHOLAR GENERAL INFO`. Natural key / idempotency: **`scholarId`** (PK).

| Canonical field | Source category · header | Type | Req | Sensitive | Notes |
|---|---|---|---|---|---|
| `scholarId` | BASIC DATA · ID | string | ✓ | no | canonical `ID_becario`; plain-text forced |
| `fullName` | BASIC DATA · Scholars Name | string | ✓ | yes | |
| `country` | BASIC DATA · Country | enum | ✓ | no | `mapCountry` → COLOMBIA/PERU |
| `cohort` | BASIC DATA · Cohort | string | ✓ | no | |
| `programStatus` | BASIC DATA · Current Status | enum | | no | `mapStatus` (substring) → ProgramStatus |
| `university` → `universityId` | BASIC DATA · University | relation | ✓ | no | **name lookup** vs `University`; unknown = error |
| `academicProgram` | BASIC DATA · Academic Program | string | ✓ | no | |
| `currentSemester` | BASIC DATA · Current Semester | int | | no | Spanish ordinal words parsed (`Sexto` → 6) |
| `gender` | BASIC DATA · Gender | string | | yes | free text |
| `ethnicGroup` / origin & residence dept/muni | BASIC DATA | string | | some | |
| `socioeconomicLevel` | BASIC DATA · Socioeconomic Level | string | | no | country-specific (SISBEN vs Perú) — display raw |
| `operator` → `operatorId` | ACOMPAÑAMIENTO ACTUAL · Current Operator - Support Services | relation | | no | **name lookup** vs `Operator`; blank = null; unknown = error |
| `estimatedGraduationYear` | BASIC DATA · Estimated Graduation Year | int | | no | bare year — **not** coerced to a date |
| `programDurationYears`, `highSchoolGraduationYear`, `motherEducationLevel`, `fatherEducationLevel`, `email1`, `email2`, `dateOfBirth`, `mobilePhone` | BASIC DATA | mixed | | some | extended profile |
| `startDate` | BASIC DATA · Started Date | date | | no | |

`Age` is **not** stored — derived from `dateOfBirth`. `expectedEndDate` has no new-sheet source and
is intentionally left null.

## ACADEMIC_TERM → `AcademicTerm`

Source: per-term columns on `SCHOLAR GENERAL INFO` (pivoted long). Natural key / idempotency:
**`(scholarId, term)`**.

| Canonical field | Source (per term) | Type | Notes |
|---|---|---|---|
| `scholarId` | BASIC DATA · ID | string | FK |
| `term` | the `YYYY-N` suffix | string | plain text; malformed → not matched |
| `gpa` | GPA · GPA {term} | float | validated **per country scale** (0–5 CO / 0–20 PE); out of range = error |
| `creditsEnrolled` | AVANCE ESTUDIOS · Credits {term} | int | |
| `enrollmentStatus` | MATRÍCULA · Enrollment Status {term} | string | display via `source-values` (MATRICULADO → Enrolled) |
| `failedSubjectsCount` | INFORMATIVO · MATERIAS REPROBADAS/CANCELADAS {term} | int | |
| `failedSubjectsDetail` | INFORMATIVO · MENCIONAR LAS ASIGNATURAS {term} | string | |
| `academicStatus` | INFORMATIVO · ESTADO FINAL (positional) | string | left null when ambiguous (2025 blocks) |

`delayedSubjects` / `levelingAlternative` / `maxDeadline` are supported on the **manual** per-term
template (single-value-per-scholar in the sheet, so not auto-attached to a term via sync).

## MENTOR_REPORT → `MentorReport`

Source: `MENTOR REPORTS` (flat, one row per session). Natural key / idempotency: **`submissionId`**
(from `Submission ID`, else synthetic `import:mentor:{scholarId}:{reportingMonth}:{sessionDate}`,
computed **after** identity resolution).

| Canonical field | Source header | Type | Notes |
|---|---|---|---|
| `scholarId` | ID OF THE SCHOLAR | string | preferred; validated vs known scholars |
| `scholarName` | Scholar's Name | string (sensitive) | name-resolved; cross-checked vs direct ID; disagreement = error |
| `mentorName` | Mentor's Name | string (sensitive) | |
| `semester`, `reportingMonth` | Semester · ¿Qué mes reportas? | string | |
| `sessionDate`, `sessionType`, `sessionSummary`, `modality` | Date of the Session · Session · Resume · Modalidad | mixed | modality display via `source-values` |
| `permanenceRisk`, `academicStatus`, `psychosocialStatus` | ¿Tiene riesgo…? · Academic Status · Psychosocial Status | string | feed the **derived** risk engine |
| `approvedCoursesCount`, `atRiskCoursesCount` | Nº aprobados · Nº en riesgo | int | |
| activity counts (`individualTutoring`, …, `workshops`) | Tutorías/Mentorías/Talleres | int | **blank ≠ 0** (see risk engine) |
| `mentorReportedGlobalStatus` | GLOBAL STATUS | string | **quarantined** — never used by risk derivation |

`MENTOR ID`, `MONTH`, `DATE`, `ACADEMIC CAUSE`, `PSYCHOSOCIAL CAUSE`, and the three "plan" columns
are intentionally unmapped (see `Normalize.gs` unmapped list).

## SUPPORT_ACTIVITY → `SupportActivity`

Source: `SUPPORT ACTIVITY LOG` (two-row merged header; month blocks pivoted long by nearest `MES`
column). Natural key / idempotency: **`(scholarId, period, activityType, source)`**.

| Canonical field | Source | Type | Notes |
|---|---|---|---|
| `scholarId` | column 0 (positional) | string | FK |
| `period` | the `MES` column's value | string | actual calendar period, not the label |
| `activityType` | sub-column (Tutorías IND, …) | enum | `ACTIVITY_TYPE_BY_KEY` |
| `activityCount` | the cell under each activity sub-column | int | **row absent = not assessed**, `0` = real zero |

A month that hasn't happened has **no row** — that absence (not a zero) is what the risk engine
reads as "participation not assessed", so it is never inferred as CRITICO.
