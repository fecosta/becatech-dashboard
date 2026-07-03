// Mock auth for the MVP: the "current user" is whoever DEMO_USER_EMAIL points at.
// Google Workspace SSO replaces this later (brief §11/§15).
import type { CurrentUser } from "./authorization";
import { prisma } from "../db";

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const email = process.env.DEMO_USER_EMAIL;
  if (!email) return null;

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
