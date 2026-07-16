"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import {
  parseTrackingTab,
  TRACKING_TAB_LABEL,
  TRACKING_TABS,
  type TrackingTab,
} from "@/lib/dashboard/tracking";

export function TrackingTabs() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const active = parseTrackingTab(searchParams.get("tab") ?? undefined);

  // Preserve all current filters; only swap the `tab` param so URLs stay shareable.
  function hrefFor(tab: TrackingTab): string {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", tab);
    return `${pathname}?${params.toString()}`;
  }

  return (
    <div className="mb-6 overflow-x-auto border-b border-slate-200">
      <nav className="-mb-px flex gap-1" aria-label="Pestañas de seguimiento">
        {TRACKING_TABS.map((tab) => {
          const isActive = tab === active;
          return (
            <Link
              key={tab}
              href={hrefFor(tab)}
              aria-current={isActive ? "page" : undefined}
              className={`whitespace-nowrap border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
                isActive
                  ? "border-slate-900 text-slate-900"
                  : "border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700"
              }`}
            >
              {TRACKING_TAB_LABEL[tab]}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
