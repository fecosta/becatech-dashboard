// Builds the lookup maps validateBatch() needs (existing scholars, controlled-value lists,
// university/operator catalogs, name index). Moved out of service.ts so the orchestrator isn't
// also the place DB-context construction lives.
import { prisma } from "../db";
import { normKey } from "./adapters/shared";
import { OPERATOR_ALIASES, UNIVERSITY_ALIASES } from "./reference-data";
import type { ValidationContext } from "./types";

export async function loadValidationContext(): Promise<ValidationContext> {
  const [scholars, controls, universities, operators] = await Promise.all([
    prisma.scholar.findMany({ select: { scholarId: true, fullName: true, country: true } }),
    prisma.controlValue.findMany({ where: { isActive: true }, select: { category: true, value: true } }),
    prisma.university.findMany({ select: { id: true, name: true } }),
    prisma.operator.findMany({ select: { id: true, name: true } }),
  ]);
  const controlMap = new Map<string, Set<string>>();
  for (const c of controls) {
    let set = controlMap.get(c.category);
    if (!set) {
      set = new Set<string>();
      controlMap.set(c.category, set);
    }
    set.add(c.value);
  }
  const universityMap = new Map<string, string>();
  for (const u of universities) universityMap.set(u.name.trim().toLowerCase(), u.id);
  // Register approved aliases → the same catalog id (e.g. "Universidad de Antioquia" → UDEA row).
  for (const [alias, canonical] of Object.entries(UNIVERSITY_ALIASES)) {
    const id = universityMap.get(canonical.trim().toLowerCase());
    if (id) universityMap.set(alias.trim().toLowerCase(), id);
  }
  const operatorMap = new Map<string, string>();
  for (const o of operators) operatorMap.set(o.name.trim().toLowerCase(), o.id);
  // Approved operator aliases: the source sheet uses short codes that don't equal the seeded
  // canonical name (e.g. "FATV" for "Fundación Antivirus para la Deserción"). Register each alias
  // pointing at the same Operator id — a controlled mapping, never an auto-created operator.
  for (const [alias, canonical] of Object.entries(OPERATOR_ALIASES)) {
    const id = operatorMap.get(canonical.trim().toLowerCase());
    if (id) operatorMap.set(alias.trim().toLowerCase(), id);
  }
  const scholarIdsByNormalizedName = new Map<string, string[]>();
  for (const s of scholars) {
    const key = normKey(s.fullName);
    if (!key) continue;
    const arr = scholarIdsByNormalizedName.get(key) ?? [];
    arr.push(s.scholarId);
    scholarIdsByNormalizedName.set(key, arr);
  }
  const countryByScholarId = new Map(scholars.map((s) => [s.scholarId, s.country] as const));
  return {
    existingScholarIds: new Set(scholars.map((s) => s.scholarId)),
    controls: controlMap,
    universities: universityMap,
    operatorsByName: operatorMap,
    scholarIdsByNormalizedName,
    countryByScholarId,
  };
}
