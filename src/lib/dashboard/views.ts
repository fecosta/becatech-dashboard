// The five primary dashboard views, in the order AUGUST 4 walks through them.
//
// Single source of truth for both the sidebar (src/app/dashboard/layout.tsx) and the
// per-page prev/next SectionNav, so the two orders cannot drift apart.
import { can, type CurrentUser, type Permission, Permission as P } from "@/lib/auth/authorization";

export interface DashboardView {
  href: string;
  label: string;
  /** Home matches its href exactly; the rest match by prefix. */
  exact?: boolean;
  permission: Permission;
}

export const VIEW_ORDER: readonly DashboardView[] = [
  { href: "/dashboard", label: "Home", exact: true, permission: P.VIEW_DASHBOARD },
  { href: "/dashboard/early-support", label: "Early Support", permission: P.VIEW_SCHOLAR_TRACKING },
  {
    href: "/dashboard/career-readiness",
    label: "Growth & Development",
    permission: P.VIEW_SCHOLAR_TRACKING,
  },
  { href: "/dashboard/scholars", label: "Scholar Progress", permission: P.VIEW_SCHOLAR_TRACKING },
  { href: "/dashboard/actors", label: "Program Ecosystem", permission: P.VIEW_SCHOLAR_TRACKING },
] as const;

/**
 * The previous and next view a given user can actually open.
 *
 * Views the role lacks permission for are skipped rather than linked: Home is
 * VIEW_DASHBOARD while the other four are VIEW_SCHOLAR_TRACKING, so a Finance or
 * Selection Team user following a naive "next" link would land on Access denied.
 * Either side is undefined at the ends of the walk, and when no permitted view
 * remains in that direction.
 */
export function adjacentViews(
  currentHref: string,
  user: CurrentUser | null,
): { prev?: DashboardView; next?: DashboardView } {
  const index = VIEW_ORDER.findIndex((v) => v.href === currentHref);
  if (index === -1 || user === null) return {};

  const firstAllowed = (from: number, step: -1 | 1): DashboardView | undefined => {
    for (let i = from; i >= 0 && i < VIEW_ORDER.length; i += step) {
      if (can(user, VIEW_ORDER[i].permission)) return VIEW_ORDER[i];
    }
    return undefined;
  };

  return {
    prev: firstAllowed(index - 1, -1),
    next: firstAllowed(index + 1, 1),
  };
}
