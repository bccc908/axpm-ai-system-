import type { UserRole } from "@/lib/auth/types";

const READ_ROLES: UserRole[] = ["owner", "admin", "sales", "finance", "viewer"];
const EDIT_ROLES: UserRole[] = ["owner", "admin", "sales", "finance"];
const APPROVE_ROLES: UserRole[] = ["owner", "admin"];

/** Logged-in staff, including read-only viewers. Customers and personal accounts are excluded. */
export function canReadKnowledge(role: UserRole): boolean {
  return READ_ROLES.includes(role);
}

/** Owner and operating staff can add or edit. Viewers stay read-only. */
export function canEditKnowledge(role: UserRole): boolean {
  return EDIT_ROLES.includes(role);
}

/** Only the owner or an admin can mark a document approved. */
export function canApproveKnowledge(role: UserRole): boolean {
  return APPROVE_ROLES.includes(role);
}
