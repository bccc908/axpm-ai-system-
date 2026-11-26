export type CrmWorkflowTrigger = "deal_stage" | "lead_status";
export type CrmWorkflowAction = "create_task" | "notify_telegram";

export type CrmWorkflowConditionField =
  | "lead.source"
  | "lead.assigned_to"
  | "deal.currency"
  | "deal.amount";

export type CrmWorkflowConditionOp = "eq" | "gte";

export interface CrmWorkflowCondition {
  field: CrmWorkflowConditionField;
  op: CrmWorkflowConditionOp;
  value: string;
}

export interface CrmWorkflow {
  id: string;
  name: string;
  enabled: boolean;
  trigger: CrmWorkflowTrigger;
  trigger_value: string;
  condition?: CrmWorkflowCondition | null;
  action: CrmWorkflowAction;
  task_title: string;
  telegram_message?: string;
  /** Required on notify_telegram. Default is the active owner. */
  approver_user_id?: string | null;
  /** Lower numbers run first when several rules match. */
  position?: number;
}

export type CrmWorkflowRunResult = "ok" | "error" | "waiting-approval" | "rejected";

export interface WorkflowActor {
  user_id: string;
  name: string;
}

export const SYSTEM_WORKFLOW_ACTOR: WorkflowActor = {
  user_id: "system",
  name: "system",
};

export interface WorkflowDecisionActor {
  user_id: string;
  name: string;
}

export interface CrmWorkflowMessageVars {
  name: string;
  company: string;
  title: string;
  amount: string;
  status: string;
  stage: string;
}

/** Allowlisted trigger snapshot. Contact identifiers are never fields on this object. */
export interface CrmWorkflowPayloadRedacted {
  rule_id: string;
  rule_name: string;
  trigger: CrmWorkflowTrigger;
  trigger_value: string;
  lead_id?: string;
  deal_id?: string;
  client_id?: string;
  display_name?: string;
  company?: string;
  stage_id?: string;
  status?: string;
  currency?: string;
  amount?: number;
  source?: string;
  assigned_to?: string;
  message_preview?: string;
}

export interface CrmWorkflowRun {
  id: string;
  created_at: string;
  rule_id: string;
  rule_name: string;
  trigger: CrmWorkflowTrigger;
  trigger_value: string;
  action: CrmWorkflowAction;
  result: CrmWorkflowRunResult;
  actor_user_id: string;
  actor_name: string;
  payload_redacted: CrmWorkflowPayloadRedacted;
  error_message: string | null;
  approved_by: WorkflowDecisionActor | null;
  approved_at: string | null;
  rejected_by: WorkflowDecisionActor | null;
  rejected_at: string | null;
  task_id: string | null;
  approver_user_id: string | null;
  /** Template with placeholders. Contact identifiers are stripped before this is stored. */
  message_template: string | null;
  message_vars: CrmWorkflowMessageVars | null;
  send_attempts: number;
}

export interface CrmWorkflowRunPublic extends Omit<CrmWorkflowRun, "message_template" | "message_vars"> {
  outbound_message: string | null;
}

export const DEFAULT_CRM_WORKFLOWS: CrmWorkflow[] = [
  {
    id: "wf-lead-qualified",
    name: "Qualified lead follow-up",
    enabled: true,
    trigger: "lead_status",
    trigger_value: "qualified",
    action: "create_task",
    task_title: "Follow up qualified lead",
  },
  {
    id: "wf-deal-deposited",
    name: "Deposited stage onboarding",
    enabled: true,
    trigger: "deal_stage",
    trigger_value: "stage-deposited",
    action: "create_task",
    task_title: "Confirm deposit and start onboarding",
  },
  {
    id: "wf-deal-negotiation",
    name: "Negotiation stage check-in",
    enabled: true,
    trigger: "deal_stage",
    trigger_value: "stage-negotiation",
    action: "create_task",
    task_title: "Negotiation follow-up call",
  },
  {
    id: "wf-lead-qualified-telegram",
    name: "Qualified lead Telegram alert",
    enabled: true,
    trigger: "lead_status",
    trigger_value: "qualified",
    action: "notify_telegram",
    task_title: "",
    telegram_message: "Qualified lead ready for follow-up: {name} ({company})",
  },
  {
    id: "wf-deal-deposited-telegram",
    name: "Deposited deal Telegram alert",
    enabled: true,
    trigger: "deal_stage",
    trigger_value: "stage-deposited",
    action: "notify_telegram",
    task_title: "",
    telegram_message: "Deal deposited — start onboarding: {title} ({amount})",
  },
];
