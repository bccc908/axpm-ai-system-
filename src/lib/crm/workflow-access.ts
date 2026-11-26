import type { UserRole } from "@/lib/auth/types";

export type WorkflowRulesAccess = "edit" | "view" | "deny";

export const WORKFLOW_RULES_PAGE = "/dashboard/crm/workflow-rules";
export const WORKFLOW_RULES_API = "/api/crm/workflows";

export function isWorkflowRulesPage(pathname: string): boolean {
  return pathname === WORKFLOW_RULES_PAGE || pathname.startsWith(`${WORKFLOW_RULES_PAGE}/`);
}

export function isWorkflowRulesApi(pathname: string): boolean {
  return pathname === WORKFLOW_RULES_API || pathname.startsWith(`${WORKFLOW_RULES_API}/`);
}

/** Owner and admin edit and approve. Sales can view. Every other role is denied. */
export function workflowRulesAccess(role: UserRole | null | undefined): WorkflowRulesAccess {
  if (role === "owner" || role === "admin") return "edit";
  if (role === "sales") return "view";
  return "deny";
}

export function canViewWorkflowRules(role: UserRole | null | undefined): boolean {
  const access = workflowRulesAccess(role);
  return access === "edit" || access === "view";
}

export function canEditWorkflowRules(role: UserRole | null | undefined): boolean {
  return workflowRulesAccess(role) === "edit";
}

/**
 * Owner and admin may always decide. Sales never can.
 * A named approver who is not sales and not a denied role may also decide.
 */
export function canApproveWorkflowRun(
  role: UserRole,
  userId: string,
  approverUserId: string | null | undefined,
): boolean {
  if (role === "sales") return false;
  if (role === "owner" || role === "admin") return true;
  if (!approverUserId || userId !== approverUserId) return false;
  return role !== "customer" && role !== "viewer" && role !== "finance" && role !== "personal";
}
