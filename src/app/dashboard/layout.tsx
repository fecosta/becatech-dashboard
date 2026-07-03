import { type ReactNode, Suspense } from "react";
import { type NavItem, Sidebar } from "@/components/Sidebar";
import { TopFilters } from "@/components/TopFilters";
import { can, Permission } from "@/lib/auth/authorization";
import { getCurrentUser } from "@/lib/auth/current-user";
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
  const [options, user] = await Promise.all([getFilterOptions(), getCurrentUser()]);

  // Show all items when no demo user is configured; otherwise filter by role.
  const items: NavItem[] = NAV.filter((n) => !user || can(user, n.permission)).map(
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
          <div className="text-right text-xs leading-tight">
            <div className="font-medium text-slate-700">{user?.fullName ?? "Invitado"}</div>
            <div className="text-slate-400">{user ? user.role.replace(/_/g, " ") : "Sin rol"}</div>
          </div>
        </header>
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
