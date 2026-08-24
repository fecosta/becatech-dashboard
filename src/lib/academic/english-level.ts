// CEFR English level parsing for the per-country distribution in AUGUST 4 §8.2.
//
// Source is Scholar.currentEnglishLevel — a single current level per scholar, synced
// from the sheet's "English level - <term>" column. There is no per-term history, so
// a progression view is not available; this is a snapshot only.
//
// About a quarter of scholars have no level recorded. The design's table sums to 100%
// across A1–C2; ours cannot honestly do that, so the parse result distinguishes
// "reported as pending" from "not applicable" from "we could not read it", and the
// caller is expected to publish coverage next to the percentages.
import { normalizeSourceValue } from "../display/source-values";

export const ENGLISH_LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"] as const;
export type EnglishLevel = (typeof ENGLISH_LEVELS)[number];

export type EnglishLevelParse =
  | { status: "OK"; level: EnglishLevel }
  | { status: "PENDING" | "NOT_APPLICABLE" | "UNRECOGNIZED"; level: null };

const PENDING = new Set(["pending", "pendiente", "pendiente de info", "wip"]);
const NOT_APPLICABLE = new Set(["not applicable", "no aplica", "n/a", "na"]);
const UNREADABLE = new Set(["", "0", "#n/a", "-", "sin informacion"]);

/**
 * Read a source English level. Accepts a sub-level suffix ("B1.2" → B1), because the
 * sheet uses those and the level is still unambiguous.
 *
 * Deliberately stricter than a `startsWith` scan: the source contains at least one
 * typo ("B!") that a prefix match would silently drop, making the denominator quietly
 * wrong rather than visibly incomplete.
 */
export function parseEnglishLevel(raw: string | null | undefined): EnglishLevelParse {
  const key = normalizeSourceValue(raw ?? "");
  if (UNREADABLE.has(key)) return { status: key === "" ? "PENDING" : "UNRECOGNIZED", level: null };
  if (PENDING.has(key)) return { status: "PENDING", level: null };
  if (NOT_APPLICABLE.has(key)) return { status: "NOT_APPLICABLE", level: null };

  const match = key.toUpperCase().match(/^([ABC][12])(?:[.\s-]\d+)?$/);
  if (match) return { status: "OK", level: match[1] as EnglishLevel };
  return { status: "UNRECOGNIZED", level: null };
}

/** A1–B1 is developing proficiency; B2–C2 is professional working proficiency. */
export const DEVELOPING_LEVELS: readonly EnglishLevel[] = ["A1", "A2", "B1"];
