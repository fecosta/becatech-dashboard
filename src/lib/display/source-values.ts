// Controlled Spanish-source-value → English display mappings. The operational Google Sheet stores
// free-text values in Spanish (e.g. "MATRICULADO(A)", "Virtual", "Bajo"); the dashboard must show
// English. This is a CONTROLLED mapping: only approved values are translated. An unknown value is
// returned verbatim with `known: false` so the caller can display it raw (never a fabricated
// translation) and, where appropriate, flag it as a data-quality issue — we never silently default
// an unrecognized value to some other meaning.
//
// Enum-backed fields (programStatus, risk levels, alert types, …) are NOT handled here — those use
// the typed maps in lib/labels.ts. This module is only for free-text source strings.

/** Normalize a raw source value for tolerant matching: strip accents, lowercase, collapse
 *  whitespace, and drop trailing gender markers like "(a)"/"(o)"/"(a/o)" and surrounding
 *  punctuation. Purely for lookup — the original value is preserved for display/audit. */
export function normalizeSourceValue(raw: string): string {
  return raw
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/\((?:a|o|a\/o|o\/a)\)/g, "") // "matriculado(a)" → "matriculado"
    .replace(/[.:;]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export type SourceValueCategory = "enrollmentStatus" | "modality" | "riskWord" | "checkinStatus";

// Keys are already normalized via normalizeSourceValue. Values are US English.
const MAPS: Record<SourceValueCategory, Record<string, string>> = {
  enrollmentStatus: {
    matriculado: "Enrolled",
    "no matriculado": "Not enrolled",
    retirado: "Withdrawn",
    aplazado: "Deferred",
    graduado: "Graduated",
  },
  modality: {
    presencial: "In person",
    virtual: "Virtual",
    hibrido: "Hybrid",
    mixto: "Hybrid",
  },
  riskWord: {
    "sin riesgo": "No risk",
    "sin alertas": "No alerts",
    bajo: "Low",
    medio: "Medium",
    alto: "High",
    critico: "Critical",
    no: "No",
    si: "Yes",
  },
  checkinStatus: {
    estable: "Stable",
    "requiere seguimiento": "Needs follow-up",
    "en riesgo": "At risk",
    "en observacion": "Under observation",
  },
};

/**
 * Translate a raw Spanish source value to English within a controlled category. Returns the English
 * value with `known: true` when the value is in the approved map; otherwise returns the raw value
 * unchanged with `known: false` (never a guessed translation). Null/blank input → `{ value: "",
 * known: true }` (nothing to translate is not an unknown value).
 */
export function translateSourceValue(
  category: SourceValueCategory,
  raw: string | null | undefined,
): { value: string; known: boolean } {
  if (raw == null || raw.trim() === "") return { value: "", known: true };
  const hit = MAPS[category][normalizeSourceValue(raw)];
  return hit ? { value: hit, known: true } : { value: raw.trim(), known: false };
}

/** Convenience for direct rendering: the English translation, or the raw value if unrecognized,
 *  or an em dash for empty input. Unknown values still surface (raw) rather than being hidden. */
export function displaySourceValue(
  category: SourceValueCategory,
  raw: string | null | undefined,
): string {
  if (raw == null || raw.trim() === "") return "—";
  return translateSourceValue(category, raw).value;
}
