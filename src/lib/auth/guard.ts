// Server-side access guards for dashboard pages. A null user (no session, or a
// session with no matching AppUser row) is always denied — proxy.ts/current-user.ts
// handle the local-dev DEMO_USER_EMAIL bypass, so by the time a user reaches here,
// null genuinely means "no usable identity," in every environment.
import { can, canAccessScholar, type CurrentUser, type Permission } from "./authorization";
import { getCurrentUser } from "./current-user";

export async function requirePermission(
  permission: Permission,
): Promise<{ user: CurrentUser | null; allowed: boolean }> {
  const user = await getCurrentUser();
  return { user, allowed: user !== null && can(user, permission) };
}

export async function requireScholarAccess(
  scholarId: string,
): Promise<{ user: CurrentUser | null; allowed: boolean }> {
  const user = await getCurrentUser();
  return { user, allowed: user !== null && canAccessScholar(user, scholarId) };
}
