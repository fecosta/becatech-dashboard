"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { href: "/dashboard", label: "Resumen ejecutivo", exact: true },
  { href: "/dashboard/risk-alerts", label: "Riesgo y alertas" },
  { href: "/dashboard/scholars", label: "Becarios" },
  { href: "/dashboard/academic-progress", label: "Avance académico" },
  { href: "/dashboard/support-participation", label: "Participación" },
  { href: "/dashboard/unit-economics", label: "Costos" },
  { href: "/dashboard/selection-pipeline", label: "Pipeline de selección" },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex w-60 shrink-0 flex-col bg-slate-900 text-slate-200">
      <div className="px-5 py-5">
        <div className="text-sm font-semibold uppercase tracking-wide text-slate-400">ver+</div>
        <div className="text-lg font-semibold text-white">Beca Tech</div>
      </div>
      <nav className="flex-1 space-y-1 px-3">
        {NAV.map((item) => {
          const active = item.exact
            ? pathname === item.href
            : pathname === item.href || pathname.startsWith(`${item.href}/`) || pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`block rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                active ? "bg-slate-700 text-white" : "text-slate-300 hover:bg-slate-800 hover:text-white"
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="px-5 py-4 text-xs text-slate-500">Scholars Progress Dashboard</div>
    </aside>
  );
}
