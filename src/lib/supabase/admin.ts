// Service-role Supabase client — for server-only Storage access (private buckets,
// signed URLs). Deliberately not @supabase/ssr's createServerClient/createBrowserClient:
// those bind to a user's cookie session; a service-role client has none, so it's
// synchronous and safe to memoize for the process lifetime.
//
// Import this ONLY from server-only code (src/lib/scholars/photos.ts today). Never from
// a "use client" component.
import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let cachedClient: SupabaseClient | null | undefined;

/**
 * Returns a memoized service-role Supabase client, or null if the required server-only
 * env vars are not configured. Never throws: a missing/misconfigured credential is a
 * degrade-gracefully case for the caller (see src/lib/scholars/photos.ts), not a
 * boot-time failure — most of the app functions fine with zero scholar photos.
 */
export function getSupabaseAdminClient(): SupabaseClient | null {
  if (cachedClient !== undefined) return cachedClient;

  // SUPABASE_URL is the non-public convention paired with a service-role key; the same
  // project's NEXT_PUBLIC_SUPABASE_URL is not secret, so it's a safe fallback for local
  // dev that only configured the existing Auth vars.
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    cachedClient = null;
    return cachedClient;
  }

  cachedClient = createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return cachedClient;
}
