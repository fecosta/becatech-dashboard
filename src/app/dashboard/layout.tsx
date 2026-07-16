import { redirect } from "next/navigation";
import { type ReactNode, Suspense } from "react";
import { type NavItem, type NavSection, Sidebar } from "@/components/Sidebar";
import { SignOutButton } from "@/components/SignOutButton";
import { TopFilters } from "@/components/TopFilters";
import { can, Permission } from "@/lib/auth/authorization";
import { getCurrentUserResult } from "@/lib/auth/current-user";
import { getFilterOptions } from "@/lib/dashboard/queries";

// Live data dashboards — always render at request time (also avoids build-time DB access).
export const dynamic = "force-dynamic";

type NavConfigItem = NavItem & { permission: Permission };
type NavConfigSection = { heading?: string; items: NavConfigItem[] };

// Narrative IA: Inicio → Seguimiento → Actores as primary; secondary tools under "Más";
// data tools under "Administración". Labels are Spanish to match the rest of the app.
const NAV: NavConfigSection[] = [
  {
    items: [
      { href: "/dashboard", label: "Inicio", exact: true, permission: Permission.VIEW_DASHBOARD },
      {
        href: "/dashboard/tracking?tab=summary",
        label: "Seguimiento",
        activePrefixes: ["/dashboard/tracking", "/dashboard/scholars"],
        permission: Permission.VIEW_SCHOLAR_TRACKING,
      },
      { href: "/dashboard/actors", label: "Actores", permission: Permission.VIEW_SCHOLAR_TRACKING },
    ],
  },
  {
    heading: "Más",
    items: [
      { href: "/dashboard/unit-economics", label: "Costos", permission: Permission.VIEW_UNIT_ECONOMICS },
      {
        href: "/dashboard/selection-pipeline",
        label: "Pipeline de selección",
        permission: Permission.VIEW_SELECTION_PIPELINE,
      },
    ],
  },
  {
    heading: "Administración",
    items: [
      // Nav gate aligned to VIEW_IMPORTS (what the pages already allow), so PROGRAM_MANAGER
      // sees the links it can actually open.
      { href: "/dashboard/admin/imports", label: "Importaciones", permission: Permission.VIEW_IMPORTS },
      { href: "/dashboard/admin/data-quality", label: "Calidad de datos", permission: Permission.VIEW_IMPORTS },
    ],
  },
];

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
    <div className="flex min-h-screen">
      <Sidebar sections={sections} />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white/90 px-6 py-3 backdrop-blur">
          <Suspense fallback={<div className="h-7" />}>
            <TopFilters options={options} />
          </Suspense>
          <div className="flex items-center gap-3">
            <div className="text-right text-xs leading-tight">
              <div className="font-medium text-slate-700">{user.fullName}</div>
              <div className="text-slate-400">{user.role.replace(/_/g, " ")}</div>
            </div>
            <SignOutButton />
          </div>
        </header>
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
