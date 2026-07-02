import { type ReactNode, Suspense } from "react";
import { Sidebar } from "@/components/Sidebar";
import { TopFilters } from "@/components/TopFilters";
import { getFilterOptions } from "@/lib/dashboard/queries";
import { prisma } from "@/lib/db";

// Live data dashboards — always render at request time (also avoids build-time DB access).
export const dynamic = "force-dynamic";

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const email = process.env.DEMO_USER_EMAIL;
  const [options, user] = await Promise.all([
    getFilterOptions(),
    email ? prisma.appUser.findUnique({ where: { email } }) : Promise.resolve(null),
  ]);

  return (
    <div className="flex min-h-screen">
      <Sidebar />
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
