// Gender is stored as free text (seed uses "Female"/"Male"/"Non-binary"/"Prefer not to
// say"; real imports may use "M"/"F", Spanish "Masculino"/"Femenino"/"Mujer"/"Hombre",
// etc.). Normalize defensively; anything unrecognized (incl. "prefer not to say") is
// "unknown" and excluded from the women-% denominator so it doesn't skew the figure.
export type NormalizedGender = "female" | "male" | "other" | "unknown";

const FEMALE = new Set(["f", "female", "femenino", "femenina", "mujer", "woman", "women"]);
const MALE = new Set(["m", "male", "masculino", "hombre", "man", "men"]);
const OTHER = new Set(["non-binary", "nonbinary", "no binario", "no-binario", "otro", "other", "x"]);

export function normalizeGender(value: string | null | undefined): NormalizedGender {
  const v = (value ?? "").trim().toLowerCase();
  if (!v) return "unknown";
  if (FEMALE.has(v)) return "female";
  if (MALE.has(v)) return "male";
  if (OTHER.has(v)) return "other";
  return "unknown";
}
