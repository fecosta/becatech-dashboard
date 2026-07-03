import { describe, expect, it } from "vitest";
import type { UserRole } from "@/generated/prisma/enums";
import {
  canAccessScholar,
  canManageData,
  canViewSelectionPipeline,
  canViewSensitiveNotes,
  canViewUnitEconomics,
  type CurrentUser,
} from "@/lib/auth/authorization";

function user(role: UserRole, assignedScholarIds: string[] = []): CurrentUser {
  return { id: `u-${role}`, email: `${role.toLowerCase()}@test`, role, assignedScholarIds };
}

describe("authorization", () => {
  it("mentor cannot access an unassigned scholar", () => {
    expect(canAccessScholar(user("MENTOR", ["BT-CO-001"]), "BT-CO-999")).toBe(false);
  });

  it("mentor can access an assigned scholar", () => {
    expect(canAccessScholar(user("MENTOR", ["BT-CO-001"]), "BT-CO-001")).toBe(true);
  });

  it("program manager can access any scholar profile (with sensitive notes)", () => {
    const pm = user("PROGRAM_MANAGER");
    expect(canAccessScholar(pm, "BT-CO-050")).toBe(true);
    expect(canViewSensitiveNotes(pm)).toBe(true);
  });

  it("executive cannot view restricted sensitive notes", () => {
    expect(canViewSensitiveNotes(user("EXECUTIVE"))).toBe(false);
  });

  it("finance can view unit economics but not scholar profiles", () => {
    const finance = user("FINANCE");
    expect(canViewUnitEconomics(finance)).toBe(true);
    expect(canAccessScholar(finance, "BT-CO-001")).toBe(false);
  });

  it("selection team can view the selection pipeline but not economics", () => {
    const sel = user("SELECTION_TEAM");
    expect(canViewSelectionPipeline(sel)).toBe(true);
    expect(canViewUnitEconomics(sel)).toBe(false);
  });

  it("only analyst/admin can manage data", () => {
    expect(canManageData(user("ANALYST_ADMIN"))).toBe(true);
    expect(canManageData(user("PROGRAM_MANAGER"))).toBe(false);
  });
});
