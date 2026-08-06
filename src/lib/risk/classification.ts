// Controlled Spanish risk-classification → RiskLevel mapping.
//
// The program's SUPPORT ACTIVITY LOG stores a per-scholar, per-month risk classification (computed
// in-sheet from diagnostic scores). We ingest the evaluated result verbatim — never re-derive it.
// Two vocabularies appear: the GLOBAL risk column uses "RIESGO …" and the per-axis (academic /
// psychosocial) columns use "… ALERTAS/BAJO/…". Both map onto the same 5-level RiskLevel taxonomy.
//
// Controlled list only: an unrecognized value resolves to null so the caller can reject the row as
// a visible data-quality issue — we never guess a level.
import { RiskLevel } from "../../generated/prisma/enums";

/** Strip accents + collapse whitespace + lowercase, so "RIESGO CRÍTICO" === "riesgo critico". */
function norm(s: string): string {
  return s
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

const BY_KEY: Record<string, RiskLevel> = {
  "sin riesgo": RiskLevel.SIN_RIESGO,
  "sin alertas": RiskLevel.SIN_RIESGO,
  "riesgo bajo": RiskLevel.RIESGO_BAJO,
  bajo: RiskLevel.RIESGO_BAJO,
  "riesgo medio": RiskLevel.RIESGO_MEDIO,
  medio: RiskLevel.RIESGO_MEDIO,
  "riesgo alto": RiskLevel.RIESGO_ALTO,
  alto: RiskLevel.RIESGO_ALTO,
  "riesgo critico": RiskLevel.CRITICO,
  critico: RiskLevel.CRITICO,
};

/**
 * Parse a stored Spanish risk/axis classification into a RiskLevel.
 * Returns null for blank/unknown input (the caller decides whether that's a skip or a hard error).
 */
export function parseRiskClassification(value: string | null | undefined): RiskLevel | null {
  if (value == null) return null;
  const key = norm(String(value));
  if (key === "") return null;
  return BY_KEY[key] ?? null;
}
