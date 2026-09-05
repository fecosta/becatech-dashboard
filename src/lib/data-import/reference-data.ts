// Controlled name-alias tables for the import validator (validation-context.ts). Moved out of
// service.ts so the orchestrator isn't also the place mapping rules live. Deliberately explicit,
// hand-maintained lists — never fuzzy-matched, never auto-created (see AGENTS.md).
import { OPERATOR_NAMES } from "../academic/operator-assignment";

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
