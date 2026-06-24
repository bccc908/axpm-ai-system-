import "server-only";

import { readAppSettings, writeAppSettings } from "@/lib/finance/settings";
import { createTask } from "@/lib/crm/store";
import { sendTelegramMessage } from "@/lib/integrations/telegram";
import type { CrmDeal } from "@/types/crm-pro";
import type { CrmLead, CrmLeadRecordStatus } from "@/types/crm-zoho";
import {
  DEFAULT_CRM_WORKFLOWS,
  type CrmWorkflow,
} from "@/types/crm-workflows";
import { formatCurrency } from "@/lib/utils";

export async function listCrmWorkflows(): Promise<CrmWorkflow[]> {
  const settings = await readAppSettings();
  const stored = settings.crmWorkflows;
  if (!stored?.length) return DEFAULT_CRM_WORKFLOWS;
  return stored;
}

export async function saveCrmWorkflows(workflows: CrmWorkflow[]) {
  await writeAppSettings({ crmWorkflows: workflows });
  return workflows;
}

function interpolate(template: string, vars: Record<string, string>) {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => vars[key] ?? "");
}

async function shouldNotifyTelegram() {
  const settings = await readAppSettings();
  return settings.crmWorkflowNotifyTelegram !== false;
}

async function runWorkflowAction(
  rule: CrmWorkflow,
  context: {
    lead?: CrmLead;
    deal?: CrmDeal;
  },
) {
  if (rule.action === "create_task") {
    const lead = context.lead;
    const deal = context.deal;
    if (lead?.client_id) {
      await createTask({
        title: `${rule.task_title}: ${lead.name}`,
        description: lead.notes,
        assigned_to: lead.assigned_to,
        client_id: lead.client_id,
        deal_id: lead.deal_id ?? null,
        status: "pending",
        due_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      });
    } else if (deal) {
      await createTask({
        title: `${rule.task_title}: ${deal.title}`,
        description: deal.notes,
        assigned_to: deal.assigned_to,
        client_id: deal.client_id,
        deal_id: deal.id,
        status: "pending",
        due_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      });
    }
    return;
  }

  if (rule.action === "notify_telegram") {
    if (!(await shouldNotifyTelegram())) return;
    const template =
      rule.telegram_message?.trim() ||
      `<b>CRM workflow</b>\n${rule.name}`;
    const lead = context.lead;
    const deal = context.deal;
    const text = interpolate(template, {
      name: lead?.name ?? "",
      company: lead?.company ?? "—",
      title: deal?.title ?? "",
      amount: deal ? formatCurrency(deal.amount, deal.currency) : "",
      status: lead?.status ?? "",
      stage: deal?.stage_id ?? "",
    });
    await sendTelegramMessage(`<b>信号旗 CRM</b>\n${text}`);
  }
}

export async function runLeadStatusWorkflows(lead: CrmLead, status: CrmLeadRecordStatus) {
  const workflows = await listCrmWorkflows();
  const matches = workflows.filter(
    (w) => w.enabled && w.trigger === "lead_status" && w.trigger_value === status,
  );
  for (const rule of matches) {
    await runWorkflowAction(rule, { lead });
  }
}

export async function runDealStageWorkflows(
  deal: CrmDeal,
  previousStageId: string,
  nextStageId: string,
) {
  if (previousStageId === nextStageId) return;

  const workflows = await listCrmWorkflows();
  const matches = workflows.filter(
    (w) => w.enabled && w.trigger === "deal_stage" && w.trigger_value === nextStageId,
  );

  for (const rule of matches) {
    await runWorkflowAction(rule, { deal });
  }
}
