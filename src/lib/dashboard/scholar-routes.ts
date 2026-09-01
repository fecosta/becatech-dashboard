// Routing for the three Scholar Profile screens: the two lists (Contact Prioritisation,
// Find a Scholar) and the individual profile they link out to.
//
// Kept pure and separate from the pages so both lists build byte-identical hrefs and the
// route shape is unit-testable — this repo tests routing by asserting config, never by
// rendering (see tests/nav-permissions.test.ts).
import { preserveParams, type SearchParams } from "./filters";

export const SCHOLAR_SECTION = {
  contact: { href: "/dashboard/scholars", label: "Contact Prioritisation" },
  find: { href: "/dashboard/scholars/find", label: "Find a Scholar" },
} as const;

export type ScholarSectionKey = keyof typeof SCHOLAR_SECTION;

/**
 * The current params minus `q`. The search term belongs to Find a Scholar alone: carried
 * onto Contact Prioritisation (which cannot use it) or onto a profile (already addressed
 * by its own id) it would be dead weight in the URL.
 */
export function withoutQuery(sp: SearchParams): SearchParams {
  return Object.fromEntries(Object.entries(sp).filter(([key]) => key !== "q"));
}

/**
 * A scholar's own URL. `scholarId` is the natural key (`Scholar.scholarId`, the source's
 * ID_becario) — the same id the lists, the mentor access scope and `getScholarProfile`
 * already key on. Dashboard filters ride along so the new tab's top bar agrees with the
 * list it was opened from.
 */
export function scholarProfileHref(scholarId: string, sp: SearchParams = {}): string {
  const path = `${SCHOLAR_SECTION.contact.href}/${encodeURIComponent(scholarId)}`;
  const qs = preserveParams(withoutQuery(sp));
  return qs ? `${path}?${qs}` : path;
}

/** A list screen's href with the current filters preserved. */
export function scholarSectionHref(key: ScholarSectionKey, sp: SearchParams = {}): string {
  const qs = preserveParams(withoutQuery(sp));
  return qs ? `${SCHOLAR_SECTION[key].href}?${qs}` : SCHOLAR_SECTION[key].href;
}
