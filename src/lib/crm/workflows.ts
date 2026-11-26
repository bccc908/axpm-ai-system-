import "server-only";

import { randomUUID } from "crypto";
import { findOwnerUser, findUserById, listUsers } from "@/lib/auth/store";
import type { UserRole } from "@/lib/auth/types";
import { readAppSettings, writeAppSettings } from "@/lib/finance/settings";
import {
  appendWorkflowRun,
  createTask,
  listWorkflowRuns,
  readCrmData,
  replaceWorkflowRun,
} from "@/lib/crm/store";
import { canApproveWorkflowRun } from "@/lib/crm/workflow-access";
import {
  WORKFLOW_ERRORS,
  buildMessageVars,
  buildRedactedPayload,
  composeOutbound,
  defaultCopyChanged,
  emptyMessageVars,
  messagePreview,
  parseWorkflowList,
  redactWorkflowText,
  scrubKnownDefaultCopy,
  sortWorkflows,
  toApprovalWorkflowRun,
  toHistoryWorkflowRun,
  workflowConditionMatches,
} from "@/lib/crm/workflow-engine";
import { getTelegramConfig, sendTelegramMessage } from "@/lib/integrations/telegram";
import type { CrmDeal } from "@/types/crm-pro";
import type { CrmLead, CrmLeadRecordStatus } from "@/types/crm-zoho";
import {
  DEFAULT_CRM_WORKFLOWS,
  SYSTEM_WORKFLOW_ACTOR,
  type CrmWorkflow,
  type CrmWorkflowRun,
  type CrmWorkflowRunPublic,
  type CrmWorkflowRunResult,
  type WorkflowActor,
} from "@/types/crm-workflows";

export class WorkflowSaveError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WorkflowSaveError";
  }
}

function actorOf(actor?: WorkflowActor | null): WorkflowActor {
  if (actor?.user_id && actor.name) {
    return { user_id: actor.user_id, name: redactWorkflowText(actor.name) || "staff" };
  }
  return SYSTEM_WORKFLOW_ACTOR;
}

export async function listCrmWorkflows(): Promise<CrmWorkflow[]> {
  const settings = await readAppSettings();
  const owner = await findOwnerUser();
  const stored = settings.crmWorkflows;
  if (!stored?.length) {
    return stampApprover(sortWorkflows(DEFAULT_CRM_WORKFLOWS.map(scrubKnownDefaultCopy)), owner?.id ?? null);
  }
  const scrubbed = stored.map(scrubKnownDefaultCopy);
  const copyChanged = scrubbed.some((rule, index) => defaultCopyChanged(stored[index], rule));
  const normalized = stampApprover(sortWorkflows(scrubbed), owner?.id ?? null);
  if (copyChanged) {
    await writeAppSettings({ crmWorkflows: normalized });
  }
  return normalized;
}

function stampApprover(rules: CrmWorkflow[], ownerId: string | null): CrmWorkflow[] {
  return rules.map((rule, position) => ({
    ...rule,
    position,
    condition: rule.condition ?? null,
    approver_user_id:
      rule.action === "notify_telegram" ? rule.approver_user_id || ownerId : null,
  }));
}

export async function saveCrmWorkflows(input: unknown) {
  const parsed = parseWorkflowList(
    Array.isArray(input) ? { workflows: input } : input && typeof input === "object" && "workflows" in input
      ? input
      : { workflows: input },
  );
  if (!parsed.ok) throw new WorkflowSaveError(parsed.error);

  const users = await listUsers();
  const owner = users.find((user) => user.role === "owner" && user.is_active) ?? null;
  const workflows = stampApprover(parsed.workflows, owner?.id ?? null);
  for (const rule of workflows) {
    if (rule.action !== "notify_telegram") continue;
    const approver = users.find((user) => user.id === rule.approver_user_id);
    if (!approver || !approver.is_active || approver.role === "customer") {
      throw new WorkflowSaveError(WORKFLOW_ERRORS.approver);
    }
  }
  await writeAppSettings({ crmWorkflows: workflows });
  return workflows;
}

export async function getWorkflowTelegramReadiness() {
  const settings = await readAppSettings();
  const config = getTelegramConfig();
  const paused = settings.crmWorkflowNotifyTelegram === false;
  return {
    ready: config.isReady && !paused,
    configured: config.isReady,
    paused,
  };
}

async function linkedDeal(lead: CrmLead): Promise<CrmDeal | null> {
  if (!lead.deal_id) return null;
  const data = await readCrmData();
  return data.deals.find((deal) => deal.id === lead.deal_id) ?? null;
}

async function linkedLead(deal: CrmDeal): Promise<CrmLead | null> {
  const data = await readCrmData();
  return data.leads?.find((lead) => lead.deal_id === deal.id) ?? null;
}

async function recordRun(run: CrmWorkflowRun) {
  await appendWorkflowRun(run);
  return run;
}

function baseRun(input: {
  rule: CrmWorkflow;
  actor: WorkflowActor;
  lead?: CrmLead | null;
  deal?: CrmDeal | null;
  result: CrmWorkflowRunResult;
  errorMessage?: string | null;
  taskId?: string | null;
  template?: string | null;
  vars?: CrmWorkflowRun["message_vars"];
}): CrmWorkflowRun {
  const preview =
    input.template && input.vars ? messagePreview(composeOutbound(input.template, input.vars)) : undefined;
  return {
    id: randomUUID(),
    created_at: new Date().toISOString(),
    rule_id: input.rule.id,
    rule_name: redactWorkflowText(input.rule.name),
    trigger: input.rule.trigger,
    trigger_value: input.rule.trigger_value,
    action: input.rule.action,
    result: input.result,
    actor_user_id: input.actor.user_id,
    actor_name: input.actor.name,
    payload_redacted: buildRedactedPayload({
      rule: input.rule,
      lead: input.lead,
      deal: input.deal,
      messagePreview: preview,
    }),
    error_message: input.errorMessage ?? null,
    approved_by: null,
    approved_at: null,
    rejected_by: null,
    rejected_at: null,
    task_id: input.taskId ?? null,
    approver_user_id: input.rule.approver_user_id ?? null,
    message_template: input.template ?? null,
    message_vars: input.vars ?? null,
    send_attempts: 0,
  };
}

async function runCreateTask(
  rule: CrmWorkflow,
  actor: WorkflowActor,
  lead: CrmLead | null,
  deal: CrmDeal | null,
  preferDeal: boolean,
) {
  const due = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  if (!preferDeal && lead?.client_id) {
    const task = await createTask({
      title: `${rule.task_title}: ${lead.name}`,
      description: lead.notes,
      assigned_to: lead.assigned_to,
      client_id: lead.client_id,
      deal_id: lead.deal_id ?? null,
      status: "pending",
      due_at: due,
    });
    await recordRun(baseRun({ rule, actor, lead, deal, result: "ok", taskId: task.id }));
    return;
  }
  if (deal?.client_id) {
    const task = await createTask({
      title: `${rule.task_title}: ${deal.title}`,
      description: deal.notes,
      assigned_to: deal.assigned_to,
      client_id: deal.client_id,
      deal_id: deal.id,
      status: "pending",
      due_at: due,
    });
    await recordRun(baseRun({ rule, actor, lead, deal, result: "ok", taskId: task.id }));
    return;
  }
  await recordRun(
    baseRun({
      rule,
      actor,
      lead,
      deal,
      result: "error",
      errorMessage: WORKFLOW_ERRORS.leadNoContext,
    }),
  );
}

async function runNotify(
  rule: CrmWorkflow,
  actor: WorkflowActor,
  lead: CrmLead | null,
  deal: CrmDeal | null,
) {
  const vars = buildMessageVars(lead, deal);
  const template = redactWorkflowText(rule.telegram_message?.trim() || rule.name) || rule.name;
  await recordRun(
    baseRun({
      rule,
      actor,
      lead,
      deal,
      result: "waiting-approval",
      template,
      vars,
    }),
  );
}

async function runOne(
  rule: CrmWorkflow,
  actor: WorkflowActor,
  lead: CrmLead | null,
  deal: CrmDeal | null,
  preferDeal: boolean,
) {
  if (!workflowConditionMatches(rule.condition, { lead, deal })) return;
  if (rule.action === "create_task") {
    await runCreateTask(rule, actor, lead, deal, preferDeal);
    return;
  }
  await runNotify(rule, actor, lead, deal);
}

export async function runLeadStatusWorkflows(
  lead: CrmLead,
  status: CrmLeadRecordStatus,
  actor?: WorkflowActor | null,
) {
  const who = actorOf(actor);
  const workflows = await listCrmWorkflows();
  const deal = await linkedDeal(lead);
  const matches = workflows.filter(
    (rule) => rule.enabled && rule.trigger === "lead_status" && rule.trigger_value === status,
  );
  for (const rule of matches) {
    await runOne(rule, who, lead, deal, false);
  }
}

export async function runDealStageWorkflows(
  deal: CrmDeal,
  previousStageId: string,
  nextStageId: string,
  actor?: WorkflowActor | null,
) {
  if (previousStageId === nextStageId) return;
  const who = actorOf(actor);
  const workflows = await listCrmWorkflows();
  const lead = await linkedLead(deal);
  const matches = workflows.filter(
    (rule) => rule.enabled && rule.trigger === "deal_stage" && rule.trigger_value === nextStageId,
  );
  for (const rule of matches) {
    await runOne(rule, who, lead, deal, true);
  }
}

export async function listWorkflowHistory(filters?: {
  ruleId?: string;
  result?: CrmWorkflowRunResult;
}): Promise<CrmWorkflowRunPublic[]> {
  let runs = await listWorkflowRuns();
  if (filters?.ruleId) runs = runs.filter((run) => run.rule_id === filters.ruleId);
  if (filters?.result) runs = runs.filter((run) => run.result === filters.result);
  return runs.map(toHistoryWorkflowRun);
}

export async function listWorkflowInbox(): Promise<CrmWorkflowRunPublic[]> {
  const runs = await listWorkflowRuns();
  return runs
    .filter((run) => run.result === "waiting-approval")
    .map(toApprovalWorkflowRun);
}

export async function decideWorkflowRun(input: {
  runId: string;
  decision: "approve" | "reject";
  actor: { user_id: string; name: string; role: UserRole };
  retry?: boolean;
}): Promise<{ ok: true; run: CrmWorkflowRunPublic } | { ok: false; status: number; error: string }> {
  const runs = await listWorkflowRuns();
  const current = runs.find((run) => run.id === input.runId);
  if (!current) return { ok: false, status: 404, error: WORKFLOW_ERRORS.notFound };
  if (!canApproveWorkflowRun(input.actor.role, input.actor.user_id, current.approver_user_id)) {
    return { ok: false, status: 403, error: WORKFLOW_ERRORS.forbidden };
  }

  const who = {
    user_id: input.actor.user_id,
    name: redactWorkflowText(input.actor.name) || "staff",
  };
  const now = new Date().toISOString();

  if (input.decision === "reject") {
    if (current.result !== "waiting-approval") {
      return { ok: false, status: 409, error: WORKFLOW_ERRORS.notWaiting };
    }
    const next: CrmWorkflowRun = {
      ...current,
      result: "rejected",
      rejected_by: who,
      rejected_at: now,
      error_message: null,
    };
    await replaceWorkflowRun(next);
    return { ok: true, run: toApprovalWorkflowRun(next) };
  }

  if (current.result === "ok") {
    return { ok: false, status: 409, error: WORKFLOW_ERRORS.alreadySent };
  }
  if (current.result === "rejected") {
    return { ok: false, status: 409, error: WORKFLOW_ERRORS.notWaiting };
  }
  if (current.result === "error") {
    if (!input.retry) return { ok: false, status: 409, error: WORKFLOW_ERRORS.retryRequired };
    if (current.send_attempts >= 2) return { ok: false, status: 409, error: WORKFLOW_ERRORS.retrySpent };
  } else if (current.result !== "waiting-approval") {
    return { ok: false, status: 409, error: WORKFLOW_ERRORS.notWaiting };
  }

  const settings = await readAppSettings();
  const paused = settings.crmWorkflowNotifyTelegram === false;
  const configured = getTelegramConfig().isReady;
  let result: CrmWorkflowRun["result"] = "error";
  let errorMessage: string | null = WORKFLOW_ERRORS.telegramSendFailed;

  if (paused) {
    errorMessage = WORKFLOW_ERRORS.telegramPaused;
  } else if (!configured) {
    errorMessage = WORKFLOW_ERRORS.telegramNotConfigured;
  } else {
    const text = composeOutbound(
      current.message_template || current.rule_name,
      current.message_vars ?? emptyMessageVars(),
    );
    try {
      const sent = await sendTelegramMessage(text);
      if (sent.ok) {
        result = "ok";
        errorMessage = null;
      }
    } catch {
      result = "error";
      errorMessage = WORKFLOW_ERRORS.telegramSendFailed;
    }
  }

  const approver = await findUserById(input.actor.user_id);
  const next: CrmWorkflowRun = {
    ...current,
    result,
    error_message: errorMessage,
    approved_by: { user_id: who.user_id, name: redactWorkflowText(approver?.name || who.name) || "staff" },
    approved_at: now,
    send_attempts: current.send_attempts + 1,
    payload_redacted: {
      ...current.payload_redacted,
      message_preview: messagePreview(
        composeOutbound(current.message_template || current.rule_name, current.message_vars),
      ),
    },
  };
  await replaceWorkflowRun(next);
    return { ok: true, run: toApprovalWorkflowRun(next) };
}
