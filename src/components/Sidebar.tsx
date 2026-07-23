"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export interface NavItem {
  href: string;
  label: string;
  /** Exact-match only (used for the Home item so it isn't active on child routes). */
  exact?: boolean;
  /** Extra path prefixes that should also mark this item active (e.g. Scholars on /dashboard/scholars). */
  activePrefixes?: string[];
}

export interface NavSection {
  heading?: string;
  items: NavItem[];
}

export interface SidebarProfile {
  name: string;
  role: string;
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

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

export function Sidebar({
  sections,
  profile,
}: {
  sections: NavSection[];
  profile?: SidebarProfile;
}) {
  const pathname = usePathname();

  return (
    <aside className="flex w-[246px] shrink-0 flex-col justify-between bg-surface-dark text-white">
      <div>
        <div className="flex items-center gap-3 border-b border-white/10 px-5 py-[22px]">
          <div className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-purple text-sm font-bold text-white">
            B+
          </div>
          <div>
            <div className="text-[15px] font-bold leading-tight text-white">Beca Tech+</div>
            <div className="text-[11px] leading-tight text-white/45">Scholar Platform</div>
          </div>
        </div>
        <nav className="px-3 py-3.5 text-[13.5px]">
          {sections.map((section, i) => (
            <div key={section.heading ?? `section-${i}`} className={i > 0 ? "mt-3" : ""}>
              {section.heading ? (
                <div className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-white/40">
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
                    className={`mb-[3px] flex items-center gap-2.5 rounded-[10px] border-l-[3px] px-3 py-2.5 transition-colors ${
                      active
                        ? "border-yellow bg-purple/20 font-semibold text-yellow"
                        : "border-transparent text-white/70 hover:bg-white/5 hover:text-white"
                    }`}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>
      </div>
      {profile ? (
        <div className="flex items-center gap-2.5 border-t border-white/10 px-5 py-4">
          <div className="flex h-[30px] w-[30px] items-center justify-center rounded-full bg-purple text-[11px] font-bold text-white">
            {initials(profile.name)}
          </div>
          <div>
            <div className="text-xs font-semibold leading-tight text-white">{profile.name}</div>
            <div className="text-[11px] leading-tight text-white/45">{profile.role}</div>
          </div>
        </div>
      ) : null}
    </aside>
  );
}
