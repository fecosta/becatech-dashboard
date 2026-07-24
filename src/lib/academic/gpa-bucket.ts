// GPA bucketing (Early Support / Growth & Development "GPA distribution" stat chips).
// Boundaries: below 3.5, [3.5, 4.0), and 4.0 and above (through the 5.0 scale max).
// Single source of truth — the query layer imports this rather than re-deriving bucket
// boundaries inline.
export type GpaBucket = "BELOW_3_5" | "GPA_3_5_TO_3_9" | "GPA_4_0_TO_5_0";

export function bucketGpa(gpa: number | null | undefined): GpaBucket | null {
  if (gpa == null) return null;
  if (gpa < 3.5) return "BELOW_3_5";
  if (gpa < 4.0) return "GPA_3_5_TO_3_9";
  return "GPA_4_0_TO_5_0";
}
