import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { DashboardShell } from "@/components/DashboardShell";
import type { NavItem, NavSection } from "@/components/Sidebar";
import { can, Permission } from "@/lib/auth/authorization";
import { getCurrentUserResult } from "@/lib/auth/current-user";
import { getFilterOptions } from "@/lib/dashboard/queries";

// Live data dashboards — always render at request time (also avoids build-time DB access).
export const dynamic = "force-dynamic";

type NavConfigItem = NavItem & { permission: Permission };
type NavConfigSection = { heading?: string; items: NavConfigItem[] };

// Beca Tech+ narrative IA (Phase B): Home → Early Support → Growth & Development →
// Scholar Progress → Program Ecosystem as the primary flow, matching the mockup's own
// nav order; secondary tools under "More"; data tools under "Admin". Permissions are
// unchanged from the prior IA so no role loses access.
const NAV: NavConfigSection[] = [
  {
    items: [
      { href: "/dashboard", label: "Home", exact: true, permission: Permission.VIEW_DASHBOARD },
      {
        href: "/dashboard/early-support",
        label: "Early Support",
        permission: Permission.VIEW_SCHOLAR_TRACKING,
      },
      {
        href: "/dashboard/career-readiness",
        label: "Growth & Development",
        permission: Permission.VIEW_SCHOLAR_TRACKING,
      },
      {
        href: "/dashboard/scholars",
        label: "Scholar Progress",
        permission: Permission.VIEW_SCHOLAR_TRACKING,
      },
      {
        href: "/dashboard/actors",
        label: "Program Ecosystem",
        permission: Permission.VIEW_SCHOLAR_TRACKING,
      },
    ],
  },
  {
    heading: "More",
    items: [
      {
        href: "/dashboard/unit-economics",
        label: "Unit Economics",
        permission: Permission.VIEW_UNIT_ECONOMICS,
      },
      {
        href: "/dashboard/selection-pipeline",
        label: "Selection Pipeline",
        permission: Permission.VIEW_SELECTION_PIPELINE,
      },
    ],
  },
  {
    heading: "Admin",
    items: [
      // Nav gate aligned to VIEW_IMPORTS (what the pages already allow), so PROGRAM_MANAGER
      // sees the links it can actually open.
      { href: "/dashboard/admin/imports", label: "Data Imports", permission: Permission.VIEW_IMPORTS },
      {
        href: "/dashboard/admin/data-quality",
        label: "Data Quality",
        permission: Permission.VIEW_IMPORTS,
      },
    ],
  },
];

/** "PROGRAM_MANAGER" -> "Program Manager" for the sidebar profile block. */
function titleCaseRole(role: string): string {
  return role
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const [options, result] = await Promise.all([getFilterOptions(), getCurrentUserResult()]);

  if (result.status !== "ok") {
    // Fast-path UX redirect only — proxy.ts already keeps signed-out requests from
    // reaching here at all; guard.ts's per-page checks remain the real enforcement
    // boundary, since Layouts don't re-render on client-side navigation between
    // sibling routes they wrap.
    redirect(result.status === "unauthenticated" ? "/login" : "/not-authorized");
  }
  const user = result.user;

  const sections: NavSection[] = NAV.map((section) => ({
    heading: section.heading,
    items: section.items
      .filter((n) => can(user, n.permission))
      .map(({ href, label, exact, activePrefixes }) => ({ href, label, exact, activePrefixes })),
  })).filter((section) => section.items.length > 0);

  return (
    <DashboardShell
      sections={sections}
      profile={{ name: user.fullName ?? user.email, role: titleCaseRole(user.role) }}
      options={options}
    >
      {children}
    </DashboardShell>
  );
}
