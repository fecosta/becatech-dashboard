// Shared by current-user.ts and proxy.ts so the local-dev DEMO_USER_EMAIL bypass can't
// drift out of sync between the two — proxy.ts runs first and must skip its Supabase
// session check whenever current-user.ts is about to use the demo fallback instead.
//
// Gated on NODE_ENV rather than Vercel's VERCEL_ENV: `next build` always sets
// NODE_ENV=production regardless of the Vercel target, so this is inert on Preview too,
// not just Production — deliberately, since Preview deployments must exercise real
// Google sign-in rather than silently keep using the demo bypass.
export function isDemoModeActive(): boolean {
  return process.env.NODE_ENV !== "production" && !!process.env.DEMO_USER_EMAIL;
}
