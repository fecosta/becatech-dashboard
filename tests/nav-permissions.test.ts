import { describe, expect, it } from "vitest";
import type { UserRole } from "@/generated/prisma/enums";
import { can, type CurrentUser, Permission } from "@/lib/auth/authorization";

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
