import { describe, expect, it } from "vitest";
import type { UserRole } from "@/generated/prisma/enums";
import { can, type CurrentUser, Permission } from "@/lib/auth/authorization";
import { adjacentViews, VIEW_ORDER } from "@/lib/dashboard/views";

// Permission gating each nav item after the Beca Tech+ IA restructure. Kept in lockstep
// with the NAV config in src/app/dashboard/layout.tsx — a regression here means a role
// gained or lost a nav entry. VIEW_SCHOLAR_TRACKING is also the guard the deprecated-route
// redirects land on, so it doubles as the "redirect doesn't bypass the target guard" check.
const NAV_PERMISSION = {
  home: Permission.VIEW_DASHBOARD,
  earlySupport: Permission.VIEW_SCHOLAR_TRACKING,
  careerReadiness: Permission.VIEW_SCHOLAR_TRACKING,
  scholars: Permission.VIEW_SCHOLAR_TRACKING,
  programEcosystem: Permission.VIEW_SCHOLAR_TRACKING,
  unitEconomics: Permission.VIEW_UNIT_ECONOMICS,
  selectionPipeline: Permission.VIEW_SELECTION_PIPELINE,
  dataImports: Permission.VIEW_IMPORTS,
  dataQuality: Permission.VIEW_IMPORTS,
} as const;

type NavKey = keyof typeof NAV_PERMISSION;
const ALL_FALSE: Record<NavKey, boolean> = {
  home: false,
  earlySupport: false,
  careerReadiness: false,
  scholars: false,
  programEcosystem: false,
  unitEconomics: false,
  selectionPipeline: false,
  dataImports: false,
  dataQuality: false,
};
// The four primary tracking destinations that share VIEW_SCHOLAR_TRACKING.
const TRACKING = {
  earlySupport: true,
  careerReadiness: true,
  scholars: true,
  programEcosystem: true,
} as const;

const u = (role: UserRole): CurrentUser => ({ id: "x", email: "x", role, assignedScholarIds: [] });

function visibleNav(role: UserRole): Record<NavKey, boolean> {
  const user = u(role);
  return Object.fromEntries(
    Object.entries(NAV_PERMISSION).map(([k, p]) => [k, can(user, p)]),
  ) as Record<NavKey, boolean>;
}

describe("nav visibility per role (Beca Tech+ IA)", () => {
  it("Finance: Home + Unit Economics only", () => {
    expect(visibleNav("FINANCE")).toEqual({ ...ALL_FALSE, home: true, unitEconomics: true });
  });

  it("Selection Team: Home + Selection Pipeline only", () => {
    expect(visibleNav("SELECTION_TEAM")).toEqual({
      ...ALL_FALSE,
      home: true,
      selectionPipeline: true,
    });
  });

  it("Mentor: Home + all tracking pages — no economics/pipeline/admin", () => {
    expect(visibleNav("MENTOR")).toEqual({ ...ALL_FALSE, home: true, ...TRACKING });
  });

  it("Program Manager: tracking + secondary tools + read-only admin", () => {
    expect(visibleNav("PROGRAM_MANAGER")).toEqual({
      ...ALL_FALSE,
      home: true,
      ...TRACKING,
      unitEconomics: true,
      selectionPipeline: true,
      dataImports: true,
      dataQuality: true,
    });
  });

  it("Executive: tracking + economics + pipeline, but not admin", () => {
    expect(visibleNav("EXECUTIVE")).toEqual({
      ...ALL_FALSE,
      home: true,
      ...TRACKING,
      unitEconomics: true,
      selectionPipeline: true,
    });
  });

  it("Analyst/Admin: everything", () => {
    expect(Object.values(visibleNav("ANALYST_ADMIN")).every(Boolean)).toBe(true);
  });
});

describe("VIEW_ORDER stays in step with the nav config", () => {
  it("lists the five primary views in the design's walk order", () => {
    expect(VIEW_ORDER.map((v) => v.href)).toEqual([
      "/dashboard",
      "/dashboard/early-support",
      "/dashboard/career-readiness",
      "/dashboard/scholars",
      "/dashboard/actors",
    ]);
  });

  it("gates each view on the same permission the nav test asserts", () => {
    expect(VIEW_ORDER.map((v) => v.permission)).toEqual([
      NAV_PERMISSION.home,
      NAV_PERMISSION.earlySupport,
      NAV_PERMISSION.careerReadiness,
      NAV_PERMISSION.scholars,
      NAV_PERMISSION.programEcosystem,
    ]);
  });
});

describe("SectionNav prev/next", () => {
  it("walks forward and back through the views for a tracking role", () => {
    const mentor = u("MENTOR");
    expect(adjacentViews("/dashboard", mentor).prev).toBeUndefined();
    expect(adjacentViews("/dashboard", mentor).next?.href).toBe("/dashboard/early-support");
    expect(adjacentViews("/dashboard/scholars", mentor).prev?.href).toBe(
      "/dashboard/career-readiness",
    );
    expect(adjacentViews("/dashboard/actors", mentor).next).toBeUndefined();
  });

  // The whole point of routing prev/next through can(): Finance has VIEW_DASHBOARD but
  // not VIEW_SCHOLAR_TRACKING, so a naive "next" link from Home would land it on the
  // Access denied card.
  it("offers no next view to a role that cannot open any of them", () => {
    expect(adjacentViews("/dashboard", u("FINANCE")).next).toBeUndefined();
    expect(adjacentViews("/dashboard", u("SELECTION_TEAM")).next).toBeUndefined();
  });

  it("returns nothing for a signed-out user or an unknown route", () => {
    expect(adjacentViews("/dashboard", null)).toEqual({});
    expect(adjacentViews("/dashboard/unit-economics", u("ANALYST_ADMIN"))).toEqual({});
  });
});
