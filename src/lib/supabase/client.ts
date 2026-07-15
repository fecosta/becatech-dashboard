// Browser Supabase client — for use in "use client" components only (e.g. the
// Google sign-in and sign-out buttons). Server code should use ./server.ts instead.
import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  );
}
