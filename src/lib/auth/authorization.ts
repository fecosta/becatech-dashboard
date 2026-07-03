// Role-based access helpers for the MVP (brief §11).
//
// Pure functions over a CurrentUser — no I/O — so they are trivial to unit test.
// The DB-backed current-user lookup lives in ./current-user.ts.
import type { UserRole } from "../../generated/prisma/enums";

export interface CurrentUser {
  id: string;
  email: string;
  role: UserRole;
  /** Display name (optional; populated by the DB-backed lookup). */
  fullName?: string;
  /** Scholar ids a mentor is assigned to (empty for other roles). */
  assignedScholarIds: string[];
}

export const Permission = {
  VIEW_DASHBOARD: "VIEW_DASHBOARD",
  VIEW_SCHOLAR_TRACKING: "VIEW_SCHOLAR_TRACKING",
  VIEW_SENSITIVE_NOTES: "VIEW_SENSITIVE_NOTES",
  VIEW_UNIT_ECONOMICS: "VIEW_UNIT_ECONOMICS",
  VIEW_SELECTION_PIPELINE: "VIEW_SELECTION_PIPELINE",
  MANAGE_DATA: "MANAGE_DATA",
} as const;
export type Permission = (typeof Permission)[keyof typeof Permission];

const P = Permission;

/** What each role may do. Analyst/Admin is the superset. */
export const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  EXECUTIVE: [P.VIEW_DASHBOARD, P.VIEW_SCHOLAR_TRACKING, P.VIEW_UNIT_ECONOMICS, P.VIEW_SELECTION_PIPELINE],
  PROGRAM_MANAGER: [
    P.VIEW_DASHBOARD,
    P.VIEW_SCHOLAR_TRACKING,
    P.VIEW_SENSITIVE_NOTES,
    P.VIEW_UNIT_ECONOMICS,
    P.VIEW_SELECTION_PIPELINE,
  ],
  MENTOR: [P.VIEW_DASHBOARD, P.VIEW_SCHOLAR_TRACKING, P.VIEW_SENSITIVE_NOTES],
  ANALYST_ADMIN: [
    P.VIEW_DASHBOARD,
    P.VIEW_SCHOLAR_TRACKING,
    P.VIEW_SENSITIVE_NOTES,
    P.VIEW_UNIT_ECONOMICS,
    P.VIEW_SELECTION_PIPELINE,
    P.MANAGE_DATA,
  ],
  FINANCE: [P.VIEW_DASHBOARD, P.VIEW_UNIT_ECONOMICS],
  SELECTION_TEAM: [P.VIEW_DASHBOARD, P.VIEW_SELECTION_PIPELINE],
};

export function can(user: CurrentUser, permission: Permission): boolean {
  return ROLE_PERMISSIONS[user.role].includes(permission);
}

/**
 * Whether a user may open a specific scholar's profile.
 * Mentors are restricted to their assigned scholars; other tracking roles see all.
 */
export function canAccessScholar(user: CurrentUser, scholarId: string): boolean {
  if (!can(user, P.VIEW_SCHOLAR_TRACKING)) return false;
  if (user.role === "MENTOR") return user.assignedScholarIds.includes(scholarId);
  return true;
}

export const canViewSensitiveNotes = (user: CurrentUser) => can(user, P.VIEW_SENSITIVE_NOTES);
export const canViewUnitEconomics = (user: CurrentUser) => can(user, P.VIEW_UNIT_ECONOMICS);
export const canViewSelectionPipeline = (user: CurrentUser) => can(user, P.VIEW_SELECTION_PIPELINE);
export const canManageData = (user: CurrentUser) => can(user, P.MANAGE_DATA);
