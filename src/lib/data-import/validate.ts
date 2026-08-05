// Validate a canonical batch and build Prisma create inputs for the valid rows.
// Field-level checks (required / type / controlled list / GPA range) run first; then
// relational checks (scholarId must exist, or be created earlier in the same batch).
import type { Prisma } from "../../generated/prisma/client";
import type {
  ActivityType,
  Country,
  ProgramStatus,
  RequestStatus,
} from "../../generated/prisma/enums";
import { GPA_SCALE_MAX } from "../academic/gpa-bucket";
import { normKey } from "./adapters/shared";
import { isBadDate, isBadNumber } from "./coerce";
import { synthSubmissionId } from "./synthkey";
import { TEMPLATE_COLUMNS } from "./templates";
import {
  type CanonicalBatch,
  type CanonicalRow,
  emptyValidatedBatch,
  type ImportEntity,
  IMPORT_ENTITY_ORDER,
  type RowError,
  type ValidationContext,
  type ValidationResult,
} from "./types";

// --- typed accessors (values are already coerced by the adapter) ---
const gS = (row: CanonicalRow, f: string): string | undefined => {
  const v = row.data[f];
  return typeof v === "string" ? v : undefined;
};
const gN = (row: CanonicalRow, f: string): number | undefined => {
  const v = row.data[f];
  return typeof v === "number" && !Number.isNaN(v) ? v : undefined;
};
const gD = (row: CanonicalRow, f: string): Date | undefined => {
  const v = row.data[f];
  return v instanceof Date && !Number.isNaN(v.getTime()) ? v : undefined;
};
const gB = (row: CanonicalRow, f: string): boolean | undefined => {
  const v = row.data[f];
  return typeof v === "boolean" ? v : undefined;
};

function checkFields(
  entity: ImportEntity,
  row: CanonicalRow,
  ctx: ValidationContext,
  errors: RowError[],
): void {
  const push = (field: string, message: string) =>
    errors.push({ entity, rowNumber: row.rowNumber, field, message });

  for (const col of TEMPLATE_COLUMNS[entity]) {
    const v = row.data[col.field];
    if (v == null) {
      if (col.required) push(col.field, "Required");
      continue;
    }
    if ((col.type === "int" || col.type === "float") && isBadNumber(v)) {
      push(col.field, "Must be a number");
      continue;
    }
    if (col.type === "date" && isBadDate(v)) {
      push(col.field, "Invalid date");
      continue;
    }
    if (col.enumCategory) {
      const allowed = ctx.controls.get(col.enumCategory);
      if (allowed && allowed.size > 0 && !allowed.has(String(v))) {
        push(col.field, `Value not allowed for ${col.enumCategory}: ${String(v)}`);
      }
    }
  }
}

// --- per-entity builders (mappers; all validation already passed) ---
function buildScholar(
  row: CanonicalRow,
  universityId: string,
  operatorId?: string,
): Prisma.ScholarUncheckedCreateInput {
  return {
    scholarId: gS(row, "scholarId")!,
    fullName: gS(row, "fullName")!,
    country: gS(row, "country") as Country,
    cohort: gS(row, "cohort")!,
    universityId,
    operatorId,
    academicProgram: gS(row, "academicProgram")!,
    gender: gS(row, "gender")!,
    programStatus: gS(row, "programStatus") as ProgramStatus | undefined,
    currentSemester: gN(row, "currentSemester"),
    currentMentor: gS(row, "currentMentor"),
    ethnicGroup: gS(row, "ethnicGroup"),
    departmentOrigin: gS(row, "departmentOrigin"),
    municipalityOrigin: gS(row, "municipalityOrigin"),
    currentDepartment: gS(row, "currentDepartment"),
    currentMunicipality: gS(row, "currentMunicipality"),
    startDate: gD(row, "startDate"),
    expectedEndDate: gD(row, "expectedEndDate"),
    driveFolderUrl: gS(row, "driveFolderUrl"),
    estimatedGraduationYear: gN(row, "estimatedGraduationYear"),
    programDurationYears: gN(row, "programDurationYears"),
    highSchoolGraduationYear: gN(row, "highSchoolGraduationYear"),
    motherEducationLevel: gS(row, "motherEducationLevel"),
    fatherEducationLevel: gS(row, "fatherEducationLevel"),
    email1: gS(row, "email1"),
    email2: gS(row, "email2"),
    dateOfBirth: gD(row, "dateOfBirth"),
    mobilePhone: gS(row, "mobilePhone"),
    socioeconomicLevel: gS(row, "socioeconomicLevel"),
  };
}

function buildAcademicTerm(row: CanonicalRow): Prisma.AcademicTermUncheckedCreateInput {
  return {
    scholarId: gS(row, "scholarId")!,
    term: gS(row, "term")!,
    enrollmentStatus: gS(row, "enrollmentStatus"),
    creditsEnrolled: gN(row, "creditsEnrolled"),
    creditsCompleted: gN(row, "creditsCompleted"),
    accumulatedCredits: gN(row, "accumulatedCredits"),
    totalProgramCredits: gN(row, "totalProgramCredits"),
    progressPercentage: gN(row, "progressPercentage"),
    gpa: gN(row, "gpa"),
    accumulatedGpa: gN(row, "accumulatedGpa"),
    failedSubjectsCount: gN(row, "failedSubjectsCount"),
    failedSubjectsDetail: gS(row, "failedSubjectsDetail"),
    delayedSubjects: gS(row, "delayedSubjects"),
    levelingAlternative: gS(row, "levelingAlternative"),
    maxDeadline: gD(row, "maxDeadline"),
    expectedProgressStatus: gS(row, "expectedProgressStatus") as
      | Prisma.AcademicTermUncheckedCreateInput["expectedProgressStatus"]
      | undefined,
    academicStatus: gS(row, "academicStatus"),
    isLeveling: gB(row, "isLeveling"),
    receivedSupport: gB(row, "receivedSupport"),
    source: "import",
  };
}

function buildMonthlyCheckin(row: CanonicalRow): Prisma.MonthlyCheckinUncheckedCreateInput {
  return {
    scholarId: gS(row, "scholarId")!,
    reportingMonth: gS(row, "reportingMonth")!,
    submissionId: gS(row, "submissionId") ?? synthSubmissionId("MONTHLY_CHECKIN", row.data),
    submissionDate: gD(row, "submissionDate"),
    scholarName: gS(row, "scholarName"),
    academicSelfReport: gS(row, "academicSelfReport"),
    academicLevel: gS(row, "academicLevel"),
    emotionalSelfReport: gS(row, "emotionalSelfReport"),
    psychosocialLevel: gS(row, "psychosocialLevel"),
    externalFactorReport: gS(row, "externalFactorReport"),
    externalFactorLevel: gS(row, "externalFactorLevel"),
    finalStatus: gS(row, "finalStatus"),
    country: gS(row, "country") as Country | undefined,
    cohort: gS(row, "cohort"),
    university: gS(row, "university"),
    sourceForm: gS(row, "sourceForm") ?? "import",
  };
}

function buildMentorReport(row: CanonicalRow): Prisma.MentorReportUncheckedCreateInput {
  return {
    scholarId: gS(row, "scholarId")!,
    reportingMonth: gS(row, "reportingMonth"),
    submissionId: gS(row, "submissionId") ?? synthSubmissionId("MENTOR_REPORT", row.data),
    scholarName: gS(row, "scholarName"),
    mentorName: gS(row, "mentorName"),
    semester: gS(row, "semester"),
    registrationDate: gD(row, "registrationDate"),
    sessionDate: gD(row, "sessionDate"),
    sessionType: gS(row, "sessionType"),
    sessionSummary: gS(row, "sessionSummary"),
    modality: gS(row, "modality"),
    permanenceRisk: gS(row, "permanenceRisk"),
    academicStatus: gS(row, "academicStatus"),
    academicAlertType: gS(row, "academicAlertType"),
    approvedCoursesCount: gN(row, "approvedCoursesCount"),
    atRiskCoursesCount: gN(row, "atRiskCoursesCount"),
    difficultSubjects: gS(row, "difficultSubjects"),
    psychosocialStatus: gS(row, "psychosocialStatus"),
    psychosocialAlertType: gS(row, "psychosocialAlertType"),
    accompanimentPlan: gS(row, "accompanimentPlan"),
    estimatedSupportTime: gS(row, "estimatedSupportTime"),
    nextSteps: gS(row, "nextSteps"),
    individualTutoring: gN(row, "individualTutoring"),
    groupTutoring: gN(row, "groupTutoring"),
    individualMentoring: gN(row, "individualMentoring"),
    groupMentoring: gN(row, "groupMentoring"),
    workshops: gN(row, "workshops"),
    highlights: gS(row, "highlights"),
    academicProgressNotes: gS(row, "academicProgressNotes"),
    // Quarantined by design — never read into risk/derive.ts or recompute.ts's mentor select.
    mentorReportedGlobalStatus: gS(row, "mentorReportedGlobalStatus"),
    country: gS(row, "country") as Country | undefined,
    cohort: gS(row, "cohort"),
    university: gS(row, "university"),
  };
}

function buildSupportActivity(row: CanonicalRow): Prisma.SupportActivityUncheckedCreateInput {
  return {
    scholarId: gS(row, "scholarId")!,
    period: gS(row, "period")!,
    activityType: gS(row, "activityType") as ActivityType,
    activityCount: gN(row, "activityCount"),
    attendanceStatus: gS(row, "attendanceStatus"),
    participationRate: gN(row, "participationRate"),
    source: gS(row, "source") ?? "import",
    notes: gS(row, "notes"),
    country: gS(row, "country") as Country | undefined,
    cohort: gS(row, "cohort"),
    university: gS(row, "university"),
  };
}

function buildScholarRequest(row: CanonicalRow): Prisma.ScholarRequestUncheckedCreateInput {
  return {
    scholarId: gS(row, "scholarId")!,
    requestType: gS(row, "requestType")!,
    submissionId: gS(row, "submissionId") ?? synthSubmissionId("SCHOLAR_REQUEST", row.data),
    submissionDate: gD(row, "submissionDate"),
    firstName: gS(row, "firstName"),
    lastName: gS(row, "lastName"),
    requestDescription: gS(row, "requestDescription"),
    status: gS(row, "status") as RequestStatus | undefined,
    responseChannel: gS(row, "responseChannel"),
    observations: gS(row, "observations"),
    owner: gS(row, "owner"),
    country: gS(row, "country") as Country | undefined,
    cohort: gS(row, "cohort"),
    university: gS(row, "university"),
  };
}

function buildFinancialInput(row: CanonicalRow): Prisma.FinancialInputUncheckedCreateInput {
  return {
    scholarId: gS(row, "scholarId")!,
    period: gS(row, "period")!,
    costCategory: gS(row, "costCategory")!,
    costAmount: gN(row, "costAmount")!,
    currency: gS(row, "currency")!,
    fundingSource: gS(row, "fundingSource"),
    isDirectCost: gB(row, "isDirectCost"),
    notes: gS(row, "notes"),
    country: gS(row, "country") as Country | undefined,
    cohort: gS(row, "cohort"),
    university: gS(row, "university"),
  };
}

export function validateBatch(batch: CanonicalBatch, ctx: ValidationContext): ValidationResult {
  const validated = emptyValidatedBatch();
  const errors: RowError[] = [];
  const scholarIds = new Set(ctx.existingScholarIds);
  const nameIndex = new Map(
    [...ctx.scholarIdsByNormalizedName].map(([k, ids]) => [k, [...ids]] as [string, string[]]),
  );
  const countryByScholarId = new Map(ctx.countryByScholarId);
  const entities: ImportEntity[] = [];
  let totalRows = 0;
  let successRows = 0;

  for (const entity of IMPORT_ENTITY_ORDER) {
    const rows = batch[entity];
    if (!rows || rows.length === 0) continue;
    entities.push(entity);

    for (const row of rows) {
      totalRows += 1;
      const before = errors.length;
      checkFields(entity, row, ctx, errors);
      if (errors.length > before) continue;

      if (entity === "MENTOR_REPORT") {
        // The old sheet had no real scholar-ID column ("Número de ID" there was the mentor's own
        // ID — see legacy-mentor-reports.ts) — resolution had to go entirely by scholarName. The
        // new sheet adds a genuine "ID OF THE SCHOLAR" column, so both signals are now resolved
        // independently and cross-checked: never guess when they disagree, but a name that fails
        // to resolve (typo/ambiguous) shouldn't reject a row a valid direct ID already identifies.
        const rawName = gS(row, "scholarName");
        const rawDirectId = gS(row, "scholarId");
        // A raw ID that isn't a real scholarId (e.g. the old sheet's mentor-ID-shaped value) is
        // treated as if absent, not as an error — matches the old sheet's existing behavior.
        const directId = rawDirectId && scholarIds.has(rawDirectId) ? rawDirectId : undefined;

        let nameResolvedId: string | undefined;
        let nameError: RowError | undefined;
        if (rawName) {
          const matches = nameIndex.get(normKey(rawName)) ?? [];
          if (matches.length === 0) {
            nameError = {
              entity,
              rowNumber: row.rowNumber,
              field: "scholarName",
              message: `Scholar not found by name: ${rawName}`,
            };
          } else if (matches.length > 1) {
            nameError = {
              entity,
              rowNumber: row.rowNumber,
              field: "scholarName",
              message: `Ambiguous scholar name (matches ${matches.length} scholars): ${rawName}`,
            };
          } else {
            nameResolvedId = matches[0];
          }
        }

        if (nameResolvedId && directId && nameResolvedId !== directId) {
          errors.push({
            entity,
            rowNumber: row.rowNumber,
            field: "scholarId",
            message: `Direct scholar ID (${directId}) does not match the name-resolved scholar (${nameResolvedId}) for "${rawName}"`,
          });
          continue;
        }

        const resolvedId = nameResolvedId ?? directId;
        if (!resolvedId) {
          // A given-but-unresolvable name is the more specific, more useful error to surface —
          // only fall back to the generic "scholarId does not exist" when no name was given at all
          // (the manual-template path, unchanged from before).
          errors.push(
            nameError ?? {
              entity,
              rowNumber: row.rowNumber,
              field: "scholarId",
              message: `scholarId does not exist: ${rawDirectId ?? ""}`,
            },
          );
          continue;
        }
        // Overwrite before buildMentorReport() runs below — it derives a synthetic submissionId
        // from scholarId when the sheet doesn't supply one, and that must be keyed on the real
        // scholar, not an unresolved/mentor's ID.
        row.data.scholarId = resolvedId;
      } else if (entity !== "SCHOLAR") {
        const sid = gS(row, "scholarId");
        if (!sid || !scholarIds.has(sid)) {
          errors.push({
            entity,
            rowNumber: row.rowNumber,
            field: "scholarId",
            message: `scholarId does not exist: ${sid ?? ""}`,
          });
          continue;
        }
        if (entity === "ACADEMIC_TERM") {
          // Colombia and Peru use different native GPA scales (0-5 vs 0-20, see
          // gpa-bucket.ts's GPA_SCALE_MAX) — validate against the scholar's own country instead
          // of a hardcoded 0-5, or Peru's legitimate GPA values get rejected as "out of range."
          const country = countryByScholarId.get(sid);
          const max = country ? GPA_SCALE_MAX[country] : GPA_SCALE_MAX.COLOMBIA;
          const before2 = errors.length;
          for (const f of ["gpa", "accumulatedGpa"]) {
            const n = gN(row, f);
            if (n !== undefined && (n < 0 || n > max)) {
              errors.push({ entity, rowNumber: row.rowNumber, field: f, message: `GPA out of range 0–${max}` });
            }
          }
          if (errors.length > before2) continue;
        }
      }

      let universityId: string | undefined;
      let operatorId: string | undefined;
      if (entity === "SCHOLAR") {
        const universityName = gS(row, "university");
        universityId = universityName
          ? ctx.universities.get(universityName.trim().toLowerCase())
          : undefined;
        if (!universityId) {
          errors.push({
            entity,
            rowNumber: row.rowNumber,
            field: "university",
            message: `University not found in the catalog: ${universityName ?? ""}`,
          });
          continue;
        }

        // Unlike university, a blank operator is valid (operatorId is nullable) — only a
        // non-blank, unmatched name is an error. Lookup-only, same as university: never
        // auto-created from an unrecognized name.
        const operatorName = gS(row, "operator");
        if (operatorName) {
          operatorId = ctx.operatorsByName.get(operatorName.trim().toLowerCase());
          if (!operatorId) {
            errors.push({
              entity,
              rowNumber: row.rowNumber,
              field: "operator",
              message: `Operator not found in the catalog: ${operatorName}`,
            });
            continue;
          }
        }
      }

      switch (entity) {
        case "SCHOLAR": {
          const r = buildScholar(row, universityId!, operatorId);
          validated.SCHOLAR.push(r);
          scholarIds.add(r.scholarId);
          countryByScholarId.set(r.scholarId, r.country as Country);
          // Grow the name index in step, so a batch containing both a SCHOLAR tab and a
          // MENTOR_REPORT tab (LEGACY_WIDE_EXCEL manual upload) can resolve names against
          // scholars created earlier in this same batch, not just pre-existing ones.
          const nameKey = normKey(r.fullName);
          if (nameKey) {
            const arr = nameIndex.get(nameKey) ?? [];
            if (!arr.includes(r.scholarId)) arr.push(r.scholarId);
            nameIndex.set(nameKey, arr);
          }
          break;
        }
        case "ACADEMIC_TERM":
          validated.ACADEMIC_TERM.push(buildAcademicTerm(row));
          break;
        case "MONTHLY_CHECKIN":
          validated.MONTHLY_CHECKIN.push(buildMonthlyCheckin(row));
          break;
        case "MENTOR_REPORT":
          validated.MENTOR_REPORT.push(buildMentorReport(row));
          break;
        case "SUPPORT_ACTIVITY":
          validated.SUPPORT_ACTIVITY.push(buildSupportActivity(row));
          break;
        case "SCHOLAR_REQUEST":
          validated.SCHOLAR_REQUEST.push(buildScholarRequest(row));
          break;
        case "FINANCIAL_INPUT":
          validated.FINANCIAL_INPUT.push(buildFinancialInput(row));
          break;
      }
      successRows += 1;
    }
  }

  return {
    validated,
    errors,
    totalRows,
    successRows,
    errorRows: totalRows - successRows,
    entities,
  };
}
