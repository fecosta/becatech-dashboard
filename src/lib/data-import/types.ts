// Shared types for the data-import pipeline (parse → adapt → validate → commit).
import type { Prisma } from "../../generated/prisma/client";
import type { Country, DataImportEntity } from "../../generated/prisma/enums";

export type ImportEntity = DataImportEntity; // "SCHOLAR" | "ACADEMIC_TERM" | ...

/** One raw record from a parsed sheet (header → cell value). */
export type RawRecord = Record<string, unknown>;

/** A coerced row before validation, tagged with its 1-based source row number. */
export interface CanonicalRow {
  rowNumber: number;
  data: Record<string, unknown>;
}

export type CanonicalBatch = Partial<Record<ImportEntity, CanonicalRow[]>>;

export interface RowError {
  entity: ImportEntity;
  rowNumber: number;
  field: string;
  message: string;
  /** Which stage produced this error. Optional/additive — existing errors (all from validate.ts)
   *  read as "VALIDATION" when absent, so this never breaks a consumer that only reads
   *  entity/rowNumber/field/message. "SOURCE" = the raw sheet's shape/columns (drift.ts);
   *  "VALIDATION" = a row's field/relational checks (validate.ts); "PERSISTENCE" = a commit-time
   *  failure (commit.ts). */
  stage?: "SOURCE" | "VALIDATION" | "PERSISTENCE";
}

/**
 * A source-specific translator from one operational spreadsheet shape into canonical ingestion
 * entities. Exactly two first-class operational adapters exist today (Scholar General Info,
 * Mentor Reports) — this is not a generic plugin system, just a shared shape for those two plus
 * the schema-drift reporting they both need. `TInput` is normally `ParsedSheet` (one sheet).
 */
export interface SourceAdapter<TInput> {
  /** Stable identifier for this source, e.g. "SCHOLAR_GENERAL_INFO". Used only for logging/
   *  reporting — never persisted as a new enum. */
  source: string;
  /** Does this input look like this adapter's source shape? (header-based self-detection). */
  canHandle(input: TInput): boolean;
  /** Translate the raw input into canonical rows. Only called after `canHandle` returns true. */
  adapt(input: TInput): CanonicalBatch;
  /** Classify this input's columns against the adapter's source contract (see source-contracts/
   *  and validation/drift.ts). Optional because not every adapter needs drift reporting. */
  inspectSchema?(input: TInput): SourceSchemaReport;
}

/** A source's expected columns, by normalized header key (see adapters/shared.ts's `normKey`) or
 *  bilingual alias group. Drives `classifyColumns` (validation/drift.ts). */
export interface SourceContract {
  /** Alias groups for columns the adapter requires to produce a usable row (e.g. the identity
   *  column). Each inner array is one logical column's accepted header spellings — only one needs
   *  to be present. */
  required: string[][];
  /** Alias groups for columns the adapter reads but that may be absent without failing the row. */
  optional: string[][];
  /** Normalized header keys already reviewed and deliberately left unmapped (documented, with a
   *  reason, at the call site) — present so they never produce an "unknown column" warning. */
  ignored: string[];
  /** Patterns for repeating per-period columns (e.g. `gpa 2026-1`) — matched in addition to the
   *  fixed alias groups above; never counted toward `missingRequired`. */
  repeating?: RegExp[];
}

/** Schema-drift classification of one sheet's header row against a `SourceContract`. Recognized/
 *  ignored/unknown are informational; a non-empty `missingRequired` is a SOURCE-stage error. */
export interface SourceSchemaReport {
  recognized: string[];
  ignored: string[];
  unknown: string[];
  missingRequired: string[];
}

/** Lookups the validator needs (existing scholars, controlled-value lists). */
export interface ValidationContext {
  existingScholarIds: Set<string>;
  /** ControlValue category → allowed values. Absent or empty ⇒ that check is skipped. */
  controls: Map<string, Set<string>>;
  /** Lowercased, trimmed University.name → University.id. */
  universities: Map<string, string>;
  /** Lowercased, trimmed Operator.name → Operator.id. Mirrors `universities`, except a blank
   *  operator name is valid (Scholar.operatorId is nullable) — only a non-blank, unmatched name
   *  is a hard error. Lookup-only, same as universities: an unmatched name is never auto-created. */
  operatorsByName: Map<string, string>;
  /** normKey(fullName) -> matching scholarId(s). Absent key = zero matches. length 1 = resolved,
   *  length > 1 = ambiguous (name collides across scholars) — both are treated as unresolved;
   *  never guess which scholar a report belongs to. Used for MENTOR_REPORT, whose source sheet
   *  has no real scholar-ID column (see legacy-mentor-reports.ts). */
  scholarIdsByNormalizedName: Map<string, string[]>;
  /** scholarId -> Scholar.country. Colombia and Peru use different native GPA scales (0-5 vs
   *  0-20, see gpa-bucket.ts's GPA_SCALE_MAX) — used to validate ACADEMIC_TERM's gpa/accumulatedGpa
   *  against the right range instead of a hardcoded 0-5. */
  countryByScholarId: Map<string, Country>;
}

/** Valid rows as Prisma create inputs, ready to upsert. */
export interface ValidatedBatch {
  SCHOLAR: Prisma.ScholarUncheckedCreateInput[];
  ACADEMIC_TERM: Prisma.AcademicTermUncheckedCreateInput[];
  MONTHLY_CHECKIN: Prisma.MonthlyCheckinUncheckedCreateInput[];
  MENTOR_REPORT: Prisma.MentorReportUncheckedCreateInput[];
  // Ingested per-scholar per-month risk classification (SUPPORT ACTIVITY LOG → RiskAssessment).
  MONTHLY_STATUS: Prisma.RiskAssessmentUncheckedCreateInput[];
  SUPPORT_ACTIVITY: Prisma.SupportActivityUncheckedCreateInput[];
  SCHOLAR_REQUEST: Prisma.ScholarRequestUncheckedCreateInput[];
  FINANCIAL_INPUT: Prisma.FinancialInputUncheckedCreateInput[];
}

export interface ValidationResult {
  validated: ValidatedBatch;
  errors: RowError[];
  totalRows: number;
  successRows: number;
  errorRows: number;
  entities: ImportEntity[];
}

export type FieldType = "string" | "int" | "float" | "date" | "boolean";

export interface FieldDef {
  /** Canonical + Prisma field name (also the template header). */
  field: string;
  type: FieldType;
  required?: boolean;
  /** ControlValue category this field is validated against. */
  enumCategory?: string;
  /** Shown as an example value in the downloadable template. */
  example?: string;
}

/** Entities processed in FK-safe order (scholars first). */
export const IMPORT_ENTITY_ORDER: ImportEntity[] = [
  "SCHOLAR",
  "ACADEMIC_TERM",
  "MONTHLY_CHECKIN",
  "MENTOR_REPORT",
  "MONTHLY_STATUS",
  "SUPPORT_ACTIVITY",
  "SCHOLAR_REQUEST",
  "FINANCIAL_INPUT",
];

export function emptyValidatedBatch(): ValidatedBatch {
  return {
    SCHOLAR: [],
    ACADEMIC_TERM: [],
    MONTHLY_CHECKIN: [],
    MENTOR_REPORT: [],
    MONTHLY_STATUS: [],
    SUPPORT_ACTIVITY: [],
    SCHOLAR_REQUEST: [],
    FINANCIAL_INPUT: [],
  };
}
