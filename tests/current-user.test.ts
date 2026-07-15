import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/db", () => ({ prisma: { appUser: { findUnique: vi.fn() } } }));

import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/db";
import { getCurrentUserResult } from "@/lib/auth/current-user";

function mockSupabaseUser(email: string | null) {
  vi.mocked(createClient).mockResolvedValue({
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: email ? { email } : null } }),
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any);
}

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://test.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_test");
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

describe("getCurrentUserResult", () => {
  it("returns unauthenticated with no session and no demo fallback", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("DEMO_USER_EMAIL", "");
    mockSupabaseUser(null);

    expect(await getCurrentUserResult()).toEqual({ status: "unauthenticated" });
  });

  it("falls back to DEMO_USER_EMAIL outside production when there's no session, resolving a mentor's assignedScholarIds", async () => {
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("DEMO_USER_EMAIL", "mentor1@becatech.test");
    mockSupabaseUser(null);
    vi.mocked(prisma.appUser.findUnique).mockResolvedValue({
      id: "u1",
      email: "mentor1@becatech.test",
      role: "MENTOR",
      fullName: "M. One",
      isActive: true,
      scholarAccess: [{ scholarId: "BT-CO-001" }, { scholarId: "BT-CO-002" }],
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    expect(await getCurrentUserResult()).toEqual({
      status: "ok",
      user: {
        id: "u1",
        email: "mentor1@becatech.test",
        role: "MENTOR",
        fullName: "M. One",
        assignedScholarIds: ["BT-CO-001", "BT-CO-002"],
      },
    });
  });

  it("returns unprovisioned when a real session has no matching AppUser", async () => {
    mockSupabaseUser("nobody@gmail.com");
    vi.mocked(prisma.appUser.findUnique).mockResolvedValue(null);

    expect(await getCurrentUserResult()).toEqual({ status: "unprovisioned" });
  });

  it("resolves a non-mentor role with empty assignedScholarIds", async () => {
    mockSupabaseUser("pm@becatech.test");
    vi.mocked(prisma.appUser.findUnique).mockResolvedValue({
      id: "u2",
      email: "pm@becatech.test",
      role: "PROGRAM_MANAGER",
      fullName: "PM",
      isActive: true,
      scholarAccess: [],
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    expect(await getCurrentUserResult()).toEqual({
      status: "ok",
      user: {
        id: "u2",
        email: "pm@becatech.test",
        role: "PROGRAM_MANAGER",
        fullName: "PM",
        assignedScholarIds: [],
      },
    });
  });

  it("treats an inactive AppUser as unprovisioned", async () => {
    mockSupabaseUser("disabled@becatech.test");
    vi.mocked(prisma.appUser.findUnique).mockResolvedValue({
      id: "u3",
      email: "disabled@becatech.test",
      role: "EXECUTIVE",
      fullName: "Disabled",
      isActive: false,
      scholarAccess: [],
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    expect(await getCurrentUserResult()).toEqual({ status: "unprovisioned" });
  });
});
