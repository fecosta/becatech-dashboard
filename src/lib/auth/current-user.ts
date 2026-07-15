// Real auth: the "current user" is whoever is signed in via Supabase Auth (Google),
// matched to a seeded AppUser by email. DEMO_USER_EMAIL remains as a local-dev-only
// fallback (see demo-mode.ts) for working without Google OAuth configured.
import type { CurrentUser } from "./authorization";
import { isDemoModeActive } from "./demo-mode";
import { prisma } from "../db";
import { createClient } from "../supabase/server";
import { isSupabaseConfigured } from "../supabase/config";

export type CurrentUserResult =
  | { status: "unauthenticated" }
  | { status: "unprovisioned" }
  | { status: "ok"; user: CurrentUser };

async function loadAppUser(email: string): Promise<CurrentUser | null> {
  const user = await prisma.appUser.findUnique({
    where: { email },
    include: { scholarAccess: { select: { scholarId: true } } },
  });
  if (!user || !user.isActive) return null;

  return {
    id: user.id,
    email: user.email,
    role: user.role,
    fullName: user.fullName,
    assignedScholarIds: user.scholarAccess.map((a) => a.scholarId),
  };
}

export async function getCurrentUserResult(): Promise<CurrentUserResult> {
  let email: string | undefined;

  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    const {
      data: { user: supabaseUser },
    } = await supabase.auth.getUser();
    email = supabaseUser?.email;
  }

  if (!email) {
    if (!isDemoModeActive()) return { status: "unauthenticated" };
    email = process.env.DEMO_USER_EMAIL;
  }

  const user = await loadAppUser(email!);
  return user ? { status: "ok", user } : { status: "unprovisioned" };
}

// Back-compat surface for guard.ts and every existing call site — none of them need to
// distinguish "no session" from "session, no matching AppUser row"; both mean "no user."
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const result = await getCurrentUserResult();
  return result.status === "ok" ? result.user : null;
}
