"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export interface NavItem {
  href: string;
  label: string;
  /** Exact-match only (used for the Home item so it isn't active on child routes). */
  exact?: boolean;
  /** Extra path prefixes that should also mark this item active (e.g. Tracking on /dashboard/scholars). */
  activePrefixes?: string[];
}

export interface NavSection {
  heading?: string;
  items: NavItem[];
}

/** The href may carry a query string (e.g. ?tab=summary); active-state matches on the path only. */
function basePath(href: string): string {
  const q = href.indexOf("?");
  return q === -1 ? href : href.slice(0, q);
}

function isActive(pathname: string, item: NavItem): boolean {
  const prefixes = [basePath(item.href), ...(item.activePrefixes ?? [])];
  return prefixes.some((p) =>
    item.exact ? pathname === p : pathname === p || pathname.startsWith(`${p}/`),
  );
}

export function Sidebar({ sections }: { sections: NavSection[] }) {
  const pathname = usePathname();

  return (
    <aside className="flex w-60 shrink-0 flex-col bg-slate-900 text-slate-200">
      <div className="px-5 py-5">
        <div className="text-sm font-semibold uppercase tracking-wide text-slate-400">ver+</div>
        <div className="text-lg font-semibold text-white">Beca Tech</div>
      </div>
      <nav className="flex-1 space-y-4 px-3">
        {sections.map((section, i) => (
          <div key={section.heading ?? `section-${i}`} className="space-y-1">
            {section.heading ? (
              <div className="px-3 pb-1 pt-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                {section.heading}
              </div>
            ) : null}
            {section.items.map((item) => {
              const active = isActive(pathname, item);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={`block rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                    active
                      ? "bg-slate-700 text-white"
                      : "text-slate-300 hover:bg-slate-800 hover:text-white"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>
      <div className="px-5 py-4 text-xs text-slate-500">Scholars Progress Dashboard</div>
    </aside>
  );
}
