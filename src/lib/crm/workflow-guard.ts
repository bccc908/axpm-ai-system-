import "server-only";

import { NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth/api-session";
import { workflowRulesAccess, type WorkflowRulesAccess } from "@/lib/crm/workflow-access";

export async function guardWorkflowRequest(need: "view" | "edit") {
  const ctx = await getServerSession();
  if (!ctx) {
    return {
      ok: false as const,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }
  const access: WorkflowRulesAccess = workflowRulesAccess(ctx.user.role);
  if (access === "deny" || (need === "edit" && access !== "edit")) {
    return {
      ok: false as const,
      response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }
  return { ok: true as const, ctx, access };
}
