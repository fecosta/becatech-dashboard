import { describe, expect, it } from "vitest";
import type { UserRole } from "@/generated/prisma/enums";
import { can, type CurrentUser, Permission } from "@/lib/auth/authorization";

// Permission gating each nav item after the PES Phase A restructure. Kept in lockstep
// with the NAV config in src/app/dashboard/layout.tsx — a regression here means a role
// gained or lost a nav entry. The Tracking gate (VIEW_SCHOLAR_TRACKING) is also the guard
// the deprecated-route redirects land on, so it doubles as the "redirect doesn't bypass
// the target guard" check.
const NAV_PERMISSION = {
  inicio: Permission.VIEW_DASHBOARD,
  seguimiento: Permission.VIEW_SCHOLAR_TRACKING,
  actores: Permission.VIEW_SCHOLAR_TRACKING,
  costos: Permission.VIEW_UNIT_ECONOMICS,
  pipeline: Permission.VIEW_SELECTION_PIPELINE,
  importaciones: Permission.VIEW_IMPORTS,
  calidadDatos: Permission.VIEW_IMPORTS,
} as const;

const u = (role: UserRole): CurrentUser => ({ id: "x", email: "x", role, assignedScholarIds: [] });

function visibleNav(role: UserRole): Record<keyof typeof NAV_PERMISSION, boolean> {
  const user = u(role);
  return Object.fromEntries(
    Object.entries(NAV_PERMISSION).map(([k, p]) => [k, can(user, p)]),
  ) as Record<keyof typeof NAV_PERMISSION, boolean>;
}

describe("nav visibility per role (PES Phase A)", () => {
  it("Finance: Inicio + Costos only — no Tracking/Actores/Pipeline/Administración", () => {
    expect(visibleNav("FINANCE")).toEqual({
      inicio: true,
      seguimiento: false,
      actores: false,
      costos: true,
      pipeline: false,
      importaciones: false,
      calidadDatos: false,
    });
  });

  it("Selection Team: Inicio + Pipeline only — no Tracking/Actores", () => {
    expect(visibleNav("SELECTION_TEAM")).toEqual({
      inicio: true,
      seguimiento: false,
      actores: false,
      costos: false,
      pipeline: true,
      importaciones: false,
      calidadDatos: false,
    });
  });

  it("Mentor: Inicio + Seguimiento + Actores — no economics/pipeline/administración", () => {
    expect(visibleNav("MENTOR")).toEqual({
      inicio: true,
      seguimiento: true,
      actores: true,
      costos: false,
      pipeline: false,
      importaciones: false,
      calidadDatos: false,
    });
  });

  it("Program Manager: Tracking + secondary tools + read-only Administración", () => {
    expect(visibleNav("PROGRAM_MANAGER")).toEqual({
      inicio: true,
      seguimiento: true,
      actores: true,
      costos: true,
      pipeline: true,
      importaciones: true,
      calidadDatos: true,
    });
  });

  it("Executive: Tracking + economics + pipeline, but not Administración", () => {
    expect(visibleNav("EXECUTIVE")).toEqual({
      inicio: true,
      seguimiento: true,
      actores: true,
      costos: true,
      pipeline: true,
      importaciones: false,
      calidadDatos: false,
    });
  });

  it("Analyst/Admin: everything", () => {
    expect(Object.values(visibleNav("ANALYST_ADMIN")).every(Boolean)).toBe(true);
  });
});
