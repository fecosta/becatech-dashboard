// Schema-drift classification for a source adapter's header row, against its SourceContract
// (source-contracts/). This is the TypeScript-side equivalent of what
// apps-script/Normalize.gs's detectUnrecognizedColumns_ already does for the automated sync —
// moved here so the manual-upload adapters get the same "did something change" safety net,
// tested alongside the rest of the pipeline instead of only observable via a Sync Log row.
import type { SourceContract, SourceSchemaReport } from "../types";

/**
 * One alias entry matches a normalized header key one of three ways, mirroring the matching
 * helpers the adapters already use (adapters/shared.ts):
 *  - exact text                → `getAny`-style equality.
 *  - a trailing `*`            → `getByKeyPrefix`-style prefix match (e.g. "genero*" matches a
 *                                 merged hint cell like "genero (m o f)").
 *  - a leading `~`              → `findByIncludes`-style substring match.
 * This lets the contract describe the same matching strategy the adapter actually uses, instead
 * of only exact aliases.
 */
function aliasMatches(headerKey: string, alias: string): boolean {
  if (alias.endsWith("*")) return headerKey.startsWith(alias.slice(0, -1));
  if (alias.startsWith("~")) return headerKey.includes(alias.slice(1));
  return headerKey === alias;
}

/** Every header key satisfying any alias in the group — not just the first. A group represents
 *  "any one of these is enough" for the *adapter's* resolution logic (e.g. either identity signal
 *  resolves a MentorReport's scholar), but more than one of them can genuinely be present as
 *  distinct real columns at once (e.g. both "ID OF THE SCHOLAR" and a mistyped "SCHOLAR'NAME") —
 *  all of them are recognized, none should show up as unknown drift. */
function findMatches(headerKeys: string[], group: string[]): string[] {
  return headerKeys.filter((key) => group.some((alias) => aliasMatches(key, alias)));
}

/**
 * Classify a sheet's (already-normalized, see adapters/shared.ts's `normKey`) header keys against
 * a source contract. Unknown columns are informational (never fail ingestion); a non-empty
 * `missingRequired` is the only SOURCE-stage error this produces.
 */
export function classifyColumns(normalizedHeaderKeys: string[], contract: SourceContract): SourceSchemaReport {
  const headerKeys = normalizedHeaderKeys.filter((k) => k !== "");
  const recognized: string[] = [];
  const missingRequired: string[] = [];

  for (const group of contract.required) {
    const matches = findMatches(headerKeys, group);
    if (matches.length > 0) recognized.push(...matches);
    else missingRequired.push(group[0]);
  }
  for (const group of contract.optional) {
    recognized.push(...findMatches(headerKeys, group));
  }

  const recognizedSet = new Set(recognized);
  const ignoredSet = new Set(contract.ignored);
  const repeating = contract.repeating ?? [];
  const ignored: string[] = [];
  const unknown: string[] = [];

  for (const key of new Set(headerKeys)) {
    if (recognizedSet.has(key)) continue;
    if (repeating.some((pattern) => pattern.test(key))) continue;
    if (ignoredSet.has(key)) ignored.push(key);
    else unknown.push(key);
  }

  return { recognized, ignored, unknown, missingRequired };
}
