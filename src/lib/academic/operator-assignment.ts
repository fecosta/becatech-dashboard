// Documented, tunable default: which delivery-partner operator serves a scholar, given
// their country and program stage. Early Support has exactly one operator per country.
// Growth & Development has no Peru-specific operator in the source roster, so Peru
// scholars default to MAKERS (named as the flagship two-year Growth & Development
// program). Colombia's two Growth & Development operators (MAKERS, Confident English)
// can't be disambiguated from country + stage alone — callers needing a single answer
// for that case (e.g. the seed script) apply their own split; this helper returns null
// there on purpose, mirroring program-stage.ts's "surfaced rather than guessed" philosophy.
import { Country } from "../../generated/prisma/enums";
import type { ProgramStage } from "./program-stage";

export const OPERATOR_NAMES = {
  EARLY_SUPPORT_COLOMBIA: "Fundación Antivirus para la Deserción",
  EARLY_SUPPORT_PERU: "ESCALO",
  GROWTH_MAKERS: "MAKERS",
  GROWTH_CONFIDENT_ENGLISH: "Confident English",
} as const;

export function defaultOperatorName(country: Country, stage: ProgramStage | null): string | null {
  if (stage === "YEARS_1_2") {
    return country === Country.COLOMBIA
      ? OPERATOR_NAMES.EARLY_SUPPORT_COLOMBIA
      : OPERATOR_NAMES.EARLY_SUPPORT_PERU;
  }
  if (stage === "YEARS_3_5") {
    return country === Country.COLOMBIA ? null : OPERATOR_NAMES.GROWTH_MAKERS;
  }
  return null;
}
