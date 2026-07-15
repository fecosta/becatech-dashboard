import { redirect } from "next/navigation";
import { type ReactNode, Suspense } from "react";
import { type NavItem, Sidebar } from "@/components/Sidebar";
import { SignOutButton } from "@/components/SignOutButton";
import { TopFilters } from "@/components/TopFilters";
import { can, Permission } from "@/lib/auth/authorization";
import { getCurrentUserResult } from "@/lib/auth/current-user";
import { getFilterOptions } from "@/lib/dashboard/queries";

// Live data dashboards — always render at request time (also avoids build-time DB access).
export const dynamic = "force-dynamic";

const NAV: (NavItem & { permission: Permission })[] = [
  { href: "/dashboard", label: "Resumen ejecutivo", exact: true, permission: Permission.VIEW_DASHBOARD },
  { href: "/dashboard/risk-alerts", label: "Riesgo y alertas", permission: Permission.VIEW_SCHOLAR_TRACKING },
  { href: "/dashboard/scholars", label: "Becarios", permission: Permission.VIEW_SCHOLAR_TRACKING },
  { href: "/dashboard/academic-progress", label: "Avance académico", permission: Permission.VIEW_SCHOLAR_TRACKING },
  { href: "/dashboard/support-participation", label: "Participación", permission: Permission.VIEW_SCHOLAR_TRACKING },
  { href: "/dashboard/unit-economics", label: "Costos", permission: Permission.VIEW_UNIT_ECONOMICS },
  { href: "/dashboard/selection-pipeline", label: "Pipeline de selección", permission: Permission.VIEW_SELECTION_PIPELINE },
  { href: "/dashboard/admin/imports", label: "Importaciones", permission: Permission.MANAGE_IMPORTS },
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

  const items: NavItem[] = NAV.filter((n) => can(user, n.permission)).map(
    ({ href, label, exact }) => ({ href, label, exact }),
  );

  return (
    <div className="flex min-h-screen">
      <Sidebar items={items} />
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
