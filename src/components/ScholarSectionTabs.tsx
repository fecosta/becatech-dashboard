// Sub-nav for the Scholar Profile section: Contact Prioritisation | Find a Scholar.
//
// The sidebar keeps one "Scholar Profile" entry (VIEW_ORDER stays the design's five-view
// walk), so the split between the two list screens is surfaced here instead. Styled with
// SectionNav's button vocabulary — same section, same visual language.
import Link from "next/link";
import type { SearchParams } from "@/lib/dashboard/filters";
import {
  SCHOLAR_SECTION,
  type ScholarSectionKey,
  scholarSectionHref,
} from "@/lib/dashboard/scholar-routes";

const BASE =
  "inline-block rounded-[10px] border-[1.5px] px-5 py-2.5 text-[12.5px] font-extrabold no-underline";
const ACTIVE = "border-surface-dark bg-surface-dark text-white";
const IDLE = "border-border bg-card text-ink hover:border-purple hover:text-purple";

const KEYS = Object.keys(SCHOLAR_SECTION) as ScholarSectionKey[];

export function ScholarSectionTabs({
  active,
  sp,
}: {
  /** Omitted on the individual profile, which is in the section but is neither tab. */
  active?: ScholarSectionKey;
  /** Current search params — filters carry across so a tab switch keeps the scope. */
  sp: SearchParams;
}) {
  return (
    <nav aria-label="Scholar Profile screens" className="mb-5 flex flex-wrap gap-2.5">
      {KEYS.map((key) => (
        <Link
          key={key}
          href={scholarSectionHref(key, sp)}
          aria-current={key === active ? "page" : undefined}
          className={`${BASE} ${key === active ? ACTIVE : IDLE}`}
        >
          {SCHOLAR_SECTION[key].label}
        </Link>
      ))}
    </nav>
  );
}
