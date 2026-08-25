// Vulnerability tiers (AUGUST 4 §4).
//
// The sheet already carries a single harmonised scale for both countries in
// Scholar.socioeconomicLevel — "Vulnerabilidad alta / moderada / baja" — so the
// cross-country SISBEN-vs-Peru reconciliation that docs/reference-data-audit.md flags
// as open has in fact been done upstream. What is NOT settled is the design's naming.
//
// The design labels the three tiers "Tier 1 · Vulnerabilidad alta", "Tier 2 · Pobreza
// moderada" and "Tier 3 · Vulnerable". Only the first is a direct restatement of the
// source value. "Vulnerabilidad baja" means less vulnerable; relabelling it "Vulnerable"
// changes what the row asserts about the scholars in it. That is a decision about how
// the program describes its own beneficiaries, not a data-normalisation detail, so the
// mapping stays switched off until someone owns it.
//
// While TIER_MAPPING_APPROVED is false the UI renders the section as pending rather
// than publishing tier percentages under labels nobody has signed off on.
import { normalizeSourceValue } from "../display/source-values";

export type SocioeconomicTier = "TIER_1" | "TIER_2" | "TIER_3";

/**
 * Flip to true only alongside the approved wording, and record who approved it and
 * when in the commit message.
 */
export const TIER_MAPPING_APPROVED = false;

/** Placeholder wording, straight from the design. Not in use until approval. */
export const SOCIOECONOMIC_TIER_LABEL: Record<SocioeconomicTier, string> = {
  TIER_1: "Tier 1 · High vulnerability",
  TIER_2: "Tier 2 · Moderate poverty",
  TIER_3: "Tier 3 · Vulnerable",
};

const TIER_BY_VALUE: Record<string, SocioeconomicTier> = {
  "vulnerabilidad alta": "TIER_1",
  "vulnerabilidad moderada": "TIER_2",
  "vulnerabilidad baja": "TIER_3",
};

export type SocioeconomicTierParse = {
  tier: SocioeconomicTier | null;
  status: "OK" | "PENDING" | "UNRECOGNIZED";
};

/**
 * About a fifth of scholars carry a literal "Pending" here. Those never receive a tier —
 * a percentage table that silently dropped them would overstate every row.
 */
export function parseSocioeconomicTier(raw: string | null | undefined): SocioeconomicTierParse {
  const key = normalizeSourceValue(raw ?? "");
  if (!key || key === "pending" || key === "pendiente") return { tier: null, status: "PENDING" };
  const tier = TIER_BY_VALUE[key];
  return tier ? { tier, status: "OK" } : { tier: null, status: "UNRECOGNIZED" };
}
