"use client";

// Owns the mobile hamburger/drawer state shared between the header's toggle button and
// the sidebar's open/closed drawer — both need to live under one client component.
import { Suspense, useState, type ReactNode } from "react";
import { initials, Sidebar, type NavSection } from "@/components/Sidebar";
import { SignOutButton } from "@/components/SignOutButton";
import { TopFilters, type FilterOptions } from "@/components/TopFilters";

export interface DashboardProfile {
  name: string;
  role: string;
}

function HamburgerIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth={2}>
      <path d="M3 6h18M3 12h18M3 18h18" strokeLinecap="round" />
    </svg>
  );
}

export function DashboardShell({
  sections,
  profile,
  options,
  children,
}: {
  sections: NavSection[];
  profile: DashboardProfile;
  options: FilterOptions;
  children: ReactNode;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex min-h-screen">
      <Sidebar sections={sections} open={sidebarOpen} onNavigate={() => setSidebarOpen(false)} />
      {sidebarOpen ? (
        <button
          aria-label="Close menu"
          onClick={() => setSidebarOpen(false)}
          className="fixed inset-0 z-30 bg-black/40 md:hidden"
        />
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-3 border-b border-border bg-cream/80 px-6 py-3 backdrop-blur">
          <div className="flex min-w-0 items-center gap-3">
            <button
              aria-label="Open menu"
              onClick={() => setSidebarOpen(true)}
              className="rounded-md border border-border bg-card p-2 text-ink hover:bg-chip-cream md:hidden"
            >
              <HamburgerIcon />
            </button>
            <Suspense fallback={<div className="h-7" />}>
              <TopFilters options={options} />
            </Suspense>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2.5">
              <div className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full bg-purple text-[11px] font-bold text-white">
                {initials(profile.name)}
              </div>
              <div className="hidden sm:block">
                <div className="text-xs font-semibold leading-tight text-ink">{profile.name}</div>
                <div className="text-[11px] leading-tight text-muted">{profile.role}</div>
              </div>
            </div>
            <SignOutButton />
          </div>
        </header>
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
