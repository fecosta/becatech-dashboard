// Shared check for whether real Supabase Auth is configured at all. Framework-agnostic
// (no next/headers import) so it's safe to use from both server code and "use client"
// components — NEXT_PUBLIC_-prefixed vars are inlined into the client bundle either way.
export function isSupabaseConfigured(): boolean {
  return !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
}
