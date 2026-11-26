import { z } from "zod";
import { formatCurrency } from "@/lib/utils";
import type { CrmDeal } from "@/types/crm-pro";
import type { CrmLead } from "@/types/crm-zoho";
import type {
  CrmWorkflow,
  CrmWorkflowCondition,
  CrmWorkflowMessageVars,
  CrmWorkflowPayloadRedacted,
  CrmWorkflowRun,
  CrmWorkflowRunPublic,
} from "@/types/crm-workflows";

export const WORKFLOW_ERRORS = {
  leadNoContext: "Lead has no client and no deal context",
  telegramNotConfigured: "Telegram is not configured",
  telegramPaused: "Telegram sends are paused by settings",
  telegramSendFailed: "Telegram send failed",
  alreadySent: "This run already completed and cannot be sent again",
  retryRequired: "Re-approve an error run with an explicit retry",
  retrySpent: "This run was already retried once",
  notWaiting: "Only a waiting run can be rejected",
  notFound: "Run not found",
  forbidden: "Forbidden",
  invalid: "Invalid workflow rule",
  approver: "Named approver must be an active staff user",
} as const;

/** Maps stored English error strings to workflowRules i18n keys. */
export const WORKFLOW_ERROR_I18N_KEYS: Record<
  (typeof WORKFLOW_ERRORS)[keyof typeof WORKFLOW_ERRORS],
  string
> = {
  [WORKFLOW_ERRORS.leadNoContext]: "workflowRules.errNoContext",
  [WORKFLOW_ERRORS.telegramNotConfigured]: "workflowRules.errNotConfigured",
  [WORKFLOW_ERRORS.telegramPaused]: "workflowRules.errPaused",
  [WORKFLOW_ERRORS.telegramSendFailed]: "workflowRules.errSendFailed",
  [WORKFLOW_ERRORS.alreadySent]: "workflowRules.errAlreadySent",
  [WORKFLOW_ERRORS.retryRequired]: "workflowRules.errRetryRequired",
  [WORKFLOW_ERRORS.retrySpent]: "workflowRules.errRetrySpent",
  [WORKFLOW_ERRORS.notWaiting]: "workflowRules.errNotWaiting",
  [WORKFLOW_ERRORS.notFound]: "workflowRules.errNotFound",
  [WORKFLOW_ERRORS.forbidden]: "workflowRules.errForbidden",
  [WORKFLOW_ERRORS.invalid]: "workflowRules.errInvalid",
  [WORKFLOW_ERRORS.approver]: "workflowRules.errApprover",
};

const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const PLUS_PHONE_RE = /\+\d{8,15}/g;
const LONG_DIGITS_RE = /\b\d{10,15}\b/g;

/** Drop emails, long digit strings, and any configured Telegram secret from text that will be stored. */
export function redactWorkflowText(value: string): string {
  let out = value;
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  const chatId = process.env.TELEGRAM_CHAT_ID?.trim();
  if (token && token.length >= 8) out = out.split(token).join("");
  if (chatId && chatId.length >= 6) out = out.split(chatId).join("");
  out = out.replace(EMAIL_RE, "");
  out = out.replace(PLUS_PHONE_RE, "");
  out = out.replace(LONG_DIGITS_RE, "");
  return out.replace(/[ \t]{2,}/g, " ").trim();
}

export function scrubKnownDefaultCopy(rule: CrmWorkflow): CrmWorkflow {
  if (rule.id === "wf-deal-deposited" && /onboard\s+ib/i.test(rule.task_title)) {
    return { ...rule, task_title: "Confirm deposit and start onboarding" };
  }
  if (
    rule.id === "wf-deal-deposited-telegram" &&
    rule.telegram_message &&
    /onboard\s+ib/i.test(rule.telegram_message)
  ) {
    return {
      ...rule,
      telegram_message: "Deal deposited — start onboarding: {title} ({amount})",
    };
  }
  return rule;
}

export function defaultCopyChanged(before: CrmWorkflow, after: CrmWorkflow): boolean {
  return (
    before.task_title !== after.task_title ||
    (before.telegram_message ?? "") !== (after.telegram_message ?? "")
  );
}

const OPS_FOR_FIELD: Record<CrmWorkflowCondition["field"], CrmWorkflowCondition["op"]> = {
  "lead.source": "eq",
  "lead.assigned_to": "eq",
  "deal.currency": "eq",
  "deal.amount": "gte",
};

export function workflowConditionMatches(
  condition: CrmWorkflowCondition | null | undefined,
  ctx: {
    lead?: { source: string | null; assigned_to: string | null } | null;
    deal?: { currency: string; amount: number } | null;
  },
): boolean {
  if (!condition) return true;
  if (OPS_FOR_FIELD[condition.field] !== condition.op) return false;
  if (condition.field === "lead.source") {
    if (!ctx.lead) return false;
    return (ctx.lead.source ?? "") === condition.value;
  }
  if (condition.field === "lead.assigned_to") {
    if (!ctx.lead) return false;
    return (ctx.lead.assigned_to ?? "") === condition.value;
  }
  if (condition.field === "deal.currency") {
    if (!ctx.deal) return false;
    return ctx.deal.currency === condition.value;
  }
  const minimum = Number(condition.value);
  if (!ctx.deal || !Number.isFinite(minimum)) return false;
  return ctx.deal.amount >= minimum;
}

function safeAmount(deal: CrmDeal): string {
  try {
    return formatCurrency(deal.amount, deal.currency);
  } catch {
    return String(deal.amount);
  }
}

export function buildMessageVars(
  lead?: CrmLead | null,
  deal?: CrmDeal | null,
): CrmWorkflowMessageVars {
  return {
    name: redactWorkflowText(lead?.name ?? ""),
    company: redactWorkflowText(lead?.company ?? ""),
    title: redactWorkflowText(deal?.title ?? ""),
    amount: deal ? safeAmount(deal) : "",
    status: lead?.status ?? deal?.status ?? "",
    stage: deal?.stage_id ?? "",
  };
}

export function interpolateWorkflowTemplate(template: string, vars: CrmWorkflowMessageVars): string {
  const lookup: Record<string, string> = { ...vars };
  return template.replace(/\{(\w+)\}/g, (_, key: string) => lookup[key] ?? "");
}

export function composeOutbound(
  template: string,
  vars: CrmWorkflowMessageVars | null,
): string {
  const clean = redactWorkflowText(template);
  const filled = vars ?? {
    name: "",
    company: "",
    title: "",
    amount: "",
    status: "",
    stage: "",
  };
  return interpolateWorkflowTemplate(clean, filled).trim();
}

export function messagePreview(text: string): string {
  const clean = redactWorkflowText(text).replace(/\s+/g, " ").trim();
  if (clean.length <= 160) return clean;
  return `${clean.slice(0, 157)}...`;
}

export function buildRedactedPayload(input: {
  rule: Pick<CrmWorkflow, "id" | "name" | "trigger" | "trigger_value">;
  lead?: CrmLead | null;
  deal?: CrmDeal | null;
  messagePreview?: string;
}): CrmWorkflowPayloadRedacted {
  const { lead, deal } = input;
  const payload: CrmWorkflowPayloadRedacted = {
    rule_id: input.rule.id,
    rule_name: redactWorkflowText(input.rule.name),
    trigger: input.rule.trigger,
    trigger_value: redactWorkflowText(input.rule.trigger_value),
  };
  if (lead?.id) payload.lead_id = lead.id;
  if (deal?.id) payload.deal_id = deal.id;
  const clientId = lead?.client_id || deal?.client_id;
  if (clientId) payload.client_id = clientId;
  const display = lead?.name || deal?.title;
  if (display) payload.display_name = redactWorkflowText(display);
  if (lead?.company) payload.company = redactWorkflowText(lead.company);
  if (deal?.stage_id) payload.stage_id = deal.stage_id;
  const status = lead?.status || deal?.status;
  if (status) payload.status = status;
  if (deal) {
    payload.currency = deal.currency;
    payload.amount = deal.amount;
  }
  if (lead?.source) payload.source = redactWorkflowText(lead.source);
  const assigned = lead?.assigned_to || deal?.assigned_to;
  if (assigned) payload.assigned_to = assigned;
  if (input.messagePreview) payload.message_preview = input.messagePreview;
  return payload;
}

function withoutStoredMessage(run: CrmWorkflowRun): Omit<CrmWorkflowRun, "message_template" | "message_vars"> {
  const { message_template: _template, message_vars: _vars, ...rest } = run;
  return rest;
}

/** History listing: allowlisted fields only. No composed outbound message. */
export function toHistoryWorkflowRun(run: CrmWorkflowRun): CrmWorkflowRunPublic {
  const rest = withoutStoredMessage(run);
  const { message_preview: _preview, ...payload } = rest.payload_redacted;
  return { ...rest, payload_redacted: payload, outbound_message: null };
}

/** Approval card: the composed message, for a waiting or failed send. */
export function toApprovalWorkflowRun(run: CrmWorkflowRun): CrmWorkflowRunPublic {
  const showOutbound = run.result === "waiting-approval" || run.result === "error";
  const outbound =
    showOutbound && run.message_template
      ? composeOutbound(run.message_template, run.message_vars)
      : null;
  return { ...withoutStoredMessage(run), outbound_message: outbound };
}

export function sortWorkflows(rules: CrmWorkflow[]): CrmWorkflow[] {
  return rules
    .map((rule, index) => ({ rule, index }))
    .sort(
      (a, b) =>
        (a.rule.position ?? a.index) - (b.rule.position ?? b.index) || a.index - b.index,
    )
    .map((item, position) => ({ ...item.rule, position }));
}

const conditionSchema = z
  .object({
    field: z.enum(["lead.source", "lead.assigned_to", "deal.currency", "deal.amount"]),
    op: z.enum(["eq", "gte"]),
    value: z.string().min(1).max(120),
  })
  .strict();

const workflowSchema = z
  .object({
    id: z.string().min(1).max(80),
    name: z.string().min(1).max(120),
    enabled: z.boolean(),
    trigger: z.enum(["deal_stage", "lead_status"]),
    trigger_value: z.string().min(1).max(80),
    condition: conditionSchema.nullable().optional(),
    action: z.enum(["create_task", "notify_telegram"]),
    task_title: z.string().max(200).optional().default(""),
    telegram_message: z.string().max(500).optional(),
    approver_user_id: z.string().min(1).max(80).nullable().optional(),
    position: z.number().int().optional(),
  })
  .strict();

export function parseWorkflowList(
  input: unknown,
): { ok: true; workflows: CrmWorkflow[] } | { ok: false; error: string } {
  const parsed = z.object({ workflows: z.array(workflowSchema).max(100) }).safeParse(input);
  if (!parsed.success) return { ok: false, error: WORKFLOW_ERRORS.invalid };

  const ids = new Set<string>();
  const workflows: CrmWorkflow[] = [];
  for (const rule of parsed.data.workflows) {
    if (ids.has(rule.id)) return { ok: false, error: WORKFLOW_ERRORS.invalid };
    ids.add(rule.id);
    const name = redactWorkflowText(rule.name);
    const taskTitle = redactWorkflowText(rule.task_title ?? "");
    const triggerValue = redactWorkflowText(rule.trigger_value);
    const telegram = rule.telegram_message ? redactWorkflowText(rule.telegram_message) : undefined;
    if (!name || !triggerValue) return { ok: false, error: WORKFLOW_ERRORS.invalid };
    if (rule.condition && OPS_FOR_FIELD[rule.condition.field] !== rule.condition.op) {
      return { ok: false, error: WORKFLOW_ERRORS.invalid };
    }
    if (rule.condition?.field === "deal.amount" && !Number.isFinite(Number(rule.condition.value))) {
      return { ok: false, error: WORKFLOW_ERRORS.invalid };
    }
    const conditionValue = rule.condition ? redactWorkflowText(rule.condition.value) : "";
    if (rule.condition && !conditionValue) return { ok: false, error: WORKFLOW_ERRORS.invalid };
    if (rule.action === "create_task" && !taskTitle) return { ok: false, error: WORKFLOW_ERRORS.invalid };
    if (rule.action === "notify_telegram" && !rule.approver_user_id) {
      return { ok: false, error: WORKFLOW_ERRORS.approver };
    }
    workflows.push({
      id: rule.id,
      name,
      enabled: rule.enabled,
      trigger: rule.trigger,
      trigger_value: triggerValue,
      condition: rule.condition
        ? {
            field: rule.condition.field,
            op: rule.condition.op,
            value: conditionValue,
          }
        : null,
      action: rule.action,
      task_title: taskTitle,
      telegram_message: telegram,
      approver_user_id: rule.action === "notify_telegram" ? rule.approver_user_id ?? null : null,
      position: workflows.length,
    });
  }
  return { ok: true, workflows };
}

export function emptyMessageVars(): CrmWorkflowMessageVars {
  return { name: "", company: "", title: "", amount: "", status: "", stage: "" };
}
