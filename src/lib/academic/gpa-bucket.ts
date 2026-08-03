// GPA-scale handling shared across the import pipeline, risk engine, and dashboard queries.
// Colombia and Peru use different native GPA scales (0-5 vs 0-20), and the program deliberately
// keeps each country's GPA on its own native scale rather than converting one into the other's —
// the "GPA COL"/"GPA PER" indicators are tracked and reported as two separate numbers, never
// blended. Anything that interprets a raw `gpa` number needs to know which scale it's on.
import type { Country } from "../../generated/prisma/enums";

export const GPA_SCALE_MAX: Record<Country, number> = {
  COLOMBIA: 5,
  PERU: 20,
};

// Early Support / Growth & Development "GPA distribution" stat chips (Boundaries: below 3.5,
// [3.5, 4.0), and 4.0 and above) — labeled in the UI with Colombia's absolute scale ("Below 3.5",
// "GPA 4.0 – 5.0"), so this bucketing is Colombia-only; a Peru scholar's GPA on a 0-20 scale has
// no meaningful "3.5" equivalent under these specific labels. Single source of truth — the query
// layer imports this rather than re-deriving bucket boundaries inline.
export type GpaBucket = "BELOW_3_5" | "GPA_3_5_TO_3_9" | "GPA_4_0_TO_5_0";

export function bucketGpa(gpa: number | null | undefined, country: Country | null | undefined): GpaBucket | null {
  if (gpa == null || country !== "COLOMBIA") return null;
  if (gpa < 3.5) return "BELOW_3_5";
  if (gpa < 4.0) return "GPA_3_5_TO_3_9";
  return "GPA_4_0_TO_5_0";
}
