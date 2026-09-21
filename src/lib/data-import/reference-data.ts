// Controlled reference data for the import validator (validation-context.ts): the canonical
// Operator catalog, plus the name-alias tables that resolve source labels onto it. Moved out of
// service.ts so the orchestrator isn't also the place mapping rules live. Deliberately explicit,
// hand-maintained lists — never fuzzy-matched, never auto-created (see AGENTS.md).
import { Country, OperatorTrack } from "../../generated/prisma/enums";
import { OPERATOR_NAMES } from "../academic/operator-assignment";
import { prisma } from "../db";

/**
 * The program's four delivery partners — reference data every environment needs before the
 * Google Sheets sync can resolve `Scholar.operatorId`.
 *
 * This is a closed, hand-maintained catalog, not something ingestion discovers: an unrecognized
 * spreadsheet label never creates an Operator (see validate.ts). `Confident English` has no
 * traffic in the current source column and is expected to hold zero scholars until it does —
 * it is a real program operator, so it belongs in the catalog either way.
 *
 * Provisioned by `npm run db:seed:operators` (prisma/seed-operators.ts). Keyed on the unique
 * `Operator.name`; ids are database-generated, because nothing depends on a fixed id.
 */
export const CANONICAL_OPERATORS: { name: string; country: Country; track: OperatorTrack }[] = [
  {
    name: OPERATOR_NAMES.EARLY_SUPPORT_COLOMBIA,
    country: Country.COLOMBIA,
    track: OperatorTrack.EARLY_SUPPORT,
  },
  {
    name: OPERATOR_NAMES.EARLY_SUPPORT_PERU,
    country: Country.PERU,
    track: OperatorTrack.EARLY_SUPPORT,
  },
  {
    name: OPERATOR_NAMES.GROWTH_MAKERS,
    country: Country.COLOMBIA,
    track: OperatorTrack.GROWTH_DEVELOPMENT,
  },
  {
    name: OPERATOR_NAMES.GROWTH_CONFIDENT_ENGLISH,
    country: Country.COLOMBIA,
    track: OperatorTrack.GROWTH_DEVELOPMENT,
  },
];

export interface OperatorConflict {
  name: string;
  expected: { country: Country; track: OperatorTrack };
  actual: { country: Country; track: OperatorTrack };
}

export interface OperatorProvisionResult {
  created: string[];
  /** Already present with matching country/track — left untouched. */
  unchanged: string[];
  /** Present under a canonical name but with different country/track. Never overwritten. */
  conflicts: OperatorConflict[];
}

/**
 * Provision the canonical Operator catalog, idempotently.
 *
 * Insert-only by design. A row whose name already exists is verified, never rewritten: if its
 * country or track disagrees with the catalog, that is reported as a conflict for a human to
 * settle rather than silently overwritten, because an existing row may already have scholars
 * pointing at it. Operator rows outside the catalog are never read, modified, or deleted.
 *
 * Safe to run against a live database — it touches nothing but the four rows below, and adds a
 * row only when that name is absent.
 */
export async function provisionOperators(): Promise<OperatorProvisionResult> {
  const existing = await prisma.operator.findMany({
    where: { name: { in: CANONICAL_OPERATORS.map((o) => o.name) } },
    select: { name: true, country: true, track: true },
  });
  const byName = new Map(existing.map((o) => [o.name, o]));

  const result: OperatorProvisionResult = { created: [], unchanged: [], conflicts: [] };
  for (const operator of CANONICAL_OPERATORS) {
    const row = byName.get(operator.name);
    if (!row) {
      await prisma.operator.create({ data: operator });
      result.created.push(operator.name);
    } else if (row.country !== operator.country || row.track !== operator.track) {
      result.conflicts.push({
        name: operator.name,
        expected: { country: operator.country, track: operator.track },
        actual: { country: row.country, track: row.track },
      });
    } else {
      result.unchanged.push(operator.name);
    }
  }
  return result;
}

/** Approved operator name aliases (source label → canonical Operator.name). The sheet uses short
 *  codes; only explicitly-approved aliases resolve, never a fuzzy/auto-created match. */
export const OPERATOR_ALIASES: Record<string, string> = {
  FATV: OPERATOR_NAMES.EARLY_SUPPORT_COLOMBIA, // "Fundación Antivirus para la Deserción"
};

/** Approved university name aliases (source label → canonical University.name already in the
 *  catalog). The catalog was hand-seeded with abbreviations (UDEA, UNAL) while the sheet spells the
 *  full names — map them so a naming variant resolves to the existing row instead of rejecting the
 *  scholar (university is a required FK). Controlled list only; never fuzzy-matched or auto-created.
 *  Add a line here when a new sheet spelling appears rather than duplicating a catalog row. */
export const UNIVERSITY_ALIASES: Record<string, string> = {
  "Universidad de Antioquia": "UDEA",
  "Universidad Nacional": "UNAL",
  "Universidad de Ingeniería y Tecnología (UTEC)": "UTEC",
  "UPC - Universidad Peruana de Ciencias Aplicadas": "UPC",
};
