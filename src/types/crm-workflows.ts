export type CrmWorkflowTrigger = "deal_stage" | "lead_status";
export type CrmWorkflowAction = "create_task" | "notify_telegram";

export interface CrmWorkflow {
  id: string;
  name: string;
  enabled: boolean;
  trigger: CrmWorkflowTrigger;
  trigger_value: string;
  action: CrmWorkflowAction;
  task_title: string;
  telegram_message?: string;
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
    task_title: "Confirm deposit and onboard IB",
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
    telegram_message: "Deal deposited — onboard IB: {title} ({amount})",
  },
];
