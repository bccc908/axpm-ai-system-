import { NextResponse } from "next/server";
import { listUsers } from "@/lib/auth/store";
import {
  getWorkflowTelegramReadiness,
  listCrmWorkflows,
  listWorkflowInbox,
  saveCrmWorkflows,
  WorkflowSaveError,
} from "@/lib/crm/workflows";
import { guardWorkflowRequest } from "@/lib/crm/workflow-guard";
import { listWorkflowRuns } from "@/lib/crm/store";

export const dynamic = "force-dynamic";

export async function GET() {
  const gate = await guardWorkflowRequest("view");
  if (!gate.ok) return gate.response;

  const [workflows, runs, waiting, telegram, users] = await Promise.all([
    listCrmWorkflows(),
    listWorkflowRuns(),
    listWorkflowInbox({ userId: gate.ctx.user.id, role: gate.ctx.user.role }),
    getWorkflowTelegramReadiness(),
    listUsers(),
  ]);
  const approvers = users
    .filter((user) => user.is_active && user.role !== "customer")
    .map((user) => ({ id: user.id, name: user.name, role: user.role }));
  const owner = users.find((user) => user.role === "owner" && user.is_active) ?? null;

  return NextResponse.json({
    workflows,
    access: gate.access,
    can_approve: gate.access === "edit",
    enabled_count: workflows.filter((rule) => rule.enabled).length,
    waiting_count: runs.filter((run) => run.result === "waiting-approval").length,
    waiting,
    telegram,
    default_approver_id: owner?.id ?? null,
    approvers,
  });
}

export async function PATCH(request: Request) {
  const gate = await guardWorkflowRequest("edit");
  if (!gate.ok) return gate.response;

  try {
    const body = await request.json();
    const workflows = await saveCrmWorkflows(body);
    return NextResponse.json({ workflows });
  } catch (error) {
    if (error instanceof WorkflowSaveError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("[CRM Workflows PATCH]");
    return NextResponse.json({ error: "Failed to save workflows" }, { status: 500 });
  }
}
