// Server-side access guards for dashboard pages. If no DEMO_USER_EMAIL is configured
// (open local dev), access is allowed; otherwise it is checked against the user's role.
import { can, canAccessScholar, type CurrentUser, type Permission } from "./authorization";
import { getCurrentUser } from "./current-user";

export async function requirePermission(
  permission: Permission,
): Promise<{ user: CurrentUser | null; allowed: boolean }> {
  const user = await getCurrentUser();
  return { user, allowed: !user || can(user, permission) };
}

export async function requireScholarAccess(
  scholarId: string,
): Promise<{ user: CurrentUser | null; allowed: boolean }> {
  const user = await getCurrentUser();
  return { user, allowed: !user || canAccessScholar(user, scholarId) };
}
