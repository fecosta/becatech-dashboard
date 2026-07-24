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
      if (col.required) push(col.field, "Requerido");
      continue;
    }
    if ((col.type === "int" || col.type === "float") && isBadNumber(v)) {
      push(col.field, "Debe ser numérico");
      continue;
    }
    if (col.type === "date" && isBadDate(v)) {
      push(col.field, "Fecha inválida");
      continue;
    }
    if (col.enumCategory) {
      const allowed = ctx.controls.get(col.enumCategory);
      if (allowed && allowed.size > 0 && !allowed.has(String(v))) {
        push(col.field, `Valor no permitido para ${col.enumCategory}: ${String(v)}`);
      }
    }
  }

  if (entity === "ACADEMIC_TERM") {
    for (const f of ["gpa", "accumulatedGpa"]) {
      const n = gN(row, f);
      if (n !== undefined && (n < 0 || n > 5)) push(f, "GPA fuera de rango 0–5");
    }
  }
}

// --- per-entity builders (mappers; all validation already passed) ---
function buildScholar(row: CanonicalRow, universityId: string): Prisma.ScholarUncheckedCreateInput {
  return {
    scholarId: gS(row, "scholarId")!,
    fullName: gS(row, "fullName")!,
    country: gS(row, "country") as Country,
    cohort: gS(row, "cohort")!,
    universityId,
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
    mentorName: gS(row, "mentorName"),
    sessionDate: gD(row, "sessionDate"),
    sessionType: gS(row, "sessionType"),
    sessionSummary: gS(row, "sessionSummary"),
    permanenceRisk: gS(row, "permanenceRisk"),
    academicStatus: gS(row, "academicStatus"),
    approvedCoursesCount: gN(row, "approvedCoursesCount"),
    atRiskCoursesCount: gN(row, "atRiskCoursesCount"),
    psychosocialStatus: gS(row, "psychosocialStatus"),
    accompanimentPlan: gS(row, "accompanimentPlan"),
    nextSteps: gS(row, "nextSteps"),
    individualTutoring: gN(row, "individualTutoring"),
    groupTutoring: gN(row, "groupTutoring"),
    individualMentoring: gN(row, "individualMentoring"),
    groupMentoring: gN(row, "groupMentoring"),
    workshops: gN(row, "workshops"),
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

      if (entity !== "SCHOLAR") {
        const sid = gS(row, "scholarId");
        if (!sid || !scholarIds.has(sid)) {
          errors.push({
            entity,
            rowNumber: row.rowNumber,
            field: "scholarId",
            message: `scholarId no existe: ${sid ?? ""}`,
          });
          continue;
        }
      }

      let universityId: string | undefined;
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
            message: `Universidad no encontrada en el catálogo: ${universityName ?? ""}`,
          });
          continue;
        }
      }

      switch (entity) {
        case "SCHOLAR": {
          const r = buildScholar(row, universityId!);
          validated.SCHOLAR.push(r);
          scholarIds.add(r.scholarId);
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
