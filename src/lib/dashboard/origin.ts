// Where scholars come from (Home §5) — department of origin for Colombia, region of
// origin for Peru.
//
// Reads Scholar.departmentOrigin, NOT currentDepartment: the design asks where a
// scholar was born or grew up, which is often not where they study.

/** Source sentinels that mean "not reported". Kept out of the counts entirely rather
 *  than folded into an "Other" bucket, which would overstate the tail. */
const NOT_REPORTED = new Set([
  "sin informacion",
  "sin información",
  "no se tiene registro",
  "n/a",
  "na",
  "pending",
  "-",
]);

/** Canonical origin name, or null when the source did not report one. */
export function normalizeOrigin(raw: string | null | undefined): string | null {
  const trimmed = raw?.trim();
  if (!trimmed) return null;
  const key = trimmed
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/\s+/g, " ");
  if (NOT_REPORTED.has(key)) return null;
  return trimmed;
}

/** Group key for origins that differ only by accent ("San Martín" / "San Martin"). */
export function originKey(name: string): string {
  return name
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** "Cohorte 2026" / "2026" → "2026". Returns null when no year is present. */
export function cohortYear(cohort: string | null | undefined): string | null {
  const match = cohort?.match(/(20\d{2})/);
  return match ? match[1] : null;
}
