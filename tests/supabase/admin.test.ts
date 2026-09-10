import { afterEach, describe, expect, it, vi } from "vitest";

// server-only's throw-on-import behavior is implemented as a package.json "exports"
// condition (the "react-server" condition resolves to a no-op instead) that only Next's
// own bundler sets — plain Vitest never does, so the real package would throw here even
// though this is a legitimate server-side test. Mocking it to a no-op mirrors what
// actually happens when this module is bundled server-side in the real app.
vi.mock("server-only", () => ({}));

// getSupabaseAdminClient memoizes its client at module scope, so each case needs a fresh
// module instance (vi.resetModules() + a dynamic import) to avoid one test's cached
// result leaking into the next.
afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("getSupabaseAdminClient", () => {
  it("returns null when the service-role key is not configured", async () => {
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");
    const { getSupabaseAdminClient } = await import("@/lib/supabase/admin");
    expect(getSupabaseAdminClient()).toBeNull();
  });

  it("returns null when the service-role key is set but no URL is configured", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    vi.stubEnv("SUPABASE_URL", "");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "test-service-role-key");
    const { getSupabaseAdminClient } = await import("@/lib/supabase/admin");
    expect(getSupabaseAdminClient()).toBeNull();
  });

  it("returns a client when the URL and service-role key are configured", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://test.supabase.co");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "test-service-role-key");
    const { getSupabaseAdminClient } = await import("@/lib/supabase/admin");
    expect(getSupabaseAdminClient()).not.toBeNull();
  });
});
