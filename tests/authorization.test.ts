import { describe, expect, it } from "vitest";
import type { UserRole } from "@/generated/prisma/enums";
import {
  canAccessScholar,
  canManageData,
  canViewSelectionPipeline,
  canViewSensitiveNotes,
  canViewUnitEconomics,
  type CurrentUser,
  scholarAccessWhere,
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

  describe("scholarAccessWhere (server-side query scoping)", () => {
    it("restricts a mentor to exactly their assigned scholars", () => {
      expect(scholarAccessWhere(user("MENTOR", ["BT-CO-001", "BT-CO-002"]))).toEqual({
        scholarId: { in: ["BT-CO-001", "BT-CO-002"] },
      });
    });

    it("a mentor with no assignments matches NO scholars (never everyone)", () => {
      expect(scholarAccessWhere(user("MENTOR", []))).toEqual({ scholarId: { in: [] } });
    });

    it("does not restrict non-mentor roles", () => {
      expect(scholarAccessWhere(user("PROGRAM_MANAGER"))).toEqual({});
      expect(scholarAccessWhere(user("EXECUTIVE"))).toEqual({});
      expect(scholarAccessWhere(user("ANALYST_ADMIN"))).toEqual({});
    });

    it("applies no restriction when there is no resolved user (non-request caller)", () => {
      expect(scholarAccessWhere(null)).toEqual({});
    });
  });
});
