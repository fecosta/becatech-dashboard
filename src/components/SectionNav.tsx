// Prev/next walk between the five primary views, matching AUGUST 4's `.section-nav`
// footer. The design's prototype uses generic "Atrás"/"Siguiente" buttons because
// every view lives in one HTML file; here they are real links, so they name their
// destination.
import Link from "next/link";
import type { CurrentUser } from "@/lib/auth/authorization";
import { preserveParams, type SearchParams } from "@/lib/dashboard/filters";
import { adjacentViews } from "@/lib/dashboard/views";

const BASE =
  "inline-block rounded-[10px] border-[1.5px] px-5 py-2.5 text-[12.5px] font-extrabold no-underline";

export function SectionNav({
  current,
  sp,
  user,
}: {
  /** The current view's href, e.g. "/dashboard/early-support". */
  current: string;
  /** Current search params — carried across so the applied filters survive the hop. */
  sp?: SearchParams;
  user: CurrentUser | null;
}) {
  const { prev, next } = adjacentViews(current, user);
  if (!prev && !next) return null;

  const query = sp ? preserveParams(sp) : "";
  const withFilters = (href: string) => (query ? `${href}?${query}` : href);

  return (
    <nav
      aria-label="Dashboard sections"
      className="mb-1.5 mt-[30px] flex items-center justify-between border-t border-border pt-[18px]"
    >
      {prev ? (
        <Link href={withFilters(prev.href)} className={`${BASE} border-border bg-card text-ink`}>
          &larr; {prev.label}
        </Link>
      ) : (
        <span />
      )}
      {next ? (
        <Link
          href={withFilters(next.href)}
          className={`${BASE} border-surface-dark bg-surface-dark text-white`}
        >
          {next.label} &rarr;
        </Link>
      ) : (
        <span />
      )}
    </nav>
  );
}
