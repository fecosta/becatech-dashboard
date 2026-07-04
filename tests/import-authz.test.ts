import { describe, expect, it } from "vitest";
import type { UserRole } from "@/generated/prisma/enums";
import { canManageImports, canViewImports, type CurrentUser } from "@/lib/auth/authorization";

const u = (role: UserRole): CurrentUser => ({ id: "x", email: "x", role, assignedScholarIds: [] });

describe("import permissions", () => {
  it("only ANALYST_ADMIN can manage imports", () => {
    expect(canManageImports(u("ANALYST_ADMIN"))).toBe(true);
    for (const r of ["EXECUTIVE", "PROGRAM_MANAGER", "MENTOR", "FINANCE", "SELECTION_TEAM"] as UserRole[]) {
      expect(canManageImports(u(r))).toBe(false);
    }
  });

  it("ANALYST_ADMIN and PROGRAM_MANAGER can view imports; others cannot", () => {
    expect(canViewImports(u("ANALYST_ADMIN"))).toBe(true);
    expect(canViewImports(u("PROGRAM_MANAGER"))).toBe(true);
    for (const r of ["EXECUTIVE", "MENTOR", "FINANCE", "SELECTION_TEAM"] as UserRole[]) {
      expect(canViewImports(u(r))).toBe(false);
    }
  });
});
