import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth/current-user", () => ({ getCurrentUser: vi.fn() }));

import type { CurrentUser } from "@/lib/auth/authorization";
import { Permission } from "@/lib/auth/authorization";
import { getCurrentUser } from "@/lib/auth/current-user";
import { requirePermission, requireScholarAccess } from "@/lib/auth/guard";

function user(overrides: Partial<CurrentUser> = {}): CurrentUser {
  return {
    id: "u1",
    email: "pm@becatech.test",
    role: "PROGRAM_MANAGER",
    assignedScholarIds: [],
    ...overrides,
  };
}

afterEach(() => {
  vi.clearAllMocks();
});

describe("requirePermission", () => {
  it("denies a null user — this is the fail-closed regression this test pins down", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null);

    const result = await requirePermission(Permission.VIEW_DASHBOARD);

    expect(result.allowed).toBe(false);
    expect(result.user).toBeNull();
  });

  it("allows a user who has the permission", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(user({ role: "EXECUTIVE" }));

    const result = await requirePermission(Permission.VIEW_DASHBOARD);

    expect(result.allowed).toBe(true);
  });

  it("denies a user who lacks the permission", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(user({ role: "FINANCE" }));

    const result = await requirePermission(Permission.MANAGE_IMPORTS);

    expect(result.allowed).toBe(false);
  });
});

describe("requireScholarAccess", () => {
  it("denies a null user", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null);

    const result = await requireScholarAccess("BT-CO-001");

    expect(result.allowed).toBe(false);
  });

  it("denies a mentor for an unassigned scholar", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(
      user({ role: "MENTOR", assignedScholarIds: ["BT-CO-001"] }),
    );

    const result = await requireScholarAccess("BT-CO-999");

    expect(result.allowed).toBe(false);
  });

  it("allows a mentor for an assigned scholar", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(
      user({ role: "MENTOR", assignedScholarIds: ["BT-CO-001"] }),
    );

    const result = await requireScholarAccess("BT-CO-001");

    expect(result.allowed).toBe(true);
  });
});
