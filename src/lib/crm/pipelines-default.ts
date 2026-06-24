import type { CrmPipeline, CrmPipelineStage } from "@/types/crm-pro";

export const DEFAULT_PIPELINE_ID = "pipeline-ib-default";

export const DEFAULT_PIPELINE_STAGES: CrmPipelineStage[] = [
  { id: "stage-new", name: "New Lead", order: 1, probability: 10, color: "64748b" },
  { id: "stage-contacted", name: "Contacted", order: 2, probability: 25, color: "3b82f6" },
  { id: "stage-qualified", name: "Qualified", order: 3, probability: 45, color: "8b5cf6" },
  { id: "stage-negotiation", name: "Negotiation", order: 4, probability: 65, color: "f59e0b" },
  { id: "stage-deposited", name: "Deposited", order: 5, probability: 85, color: "10b981" },
  { id: "stage-active", name: "Active IB", order: 6, probability: 95, color: "059669" },
];

export function buildDefaultPipeline(now = new Date().toISOString()): CrmPipeline {
  return {
    id: DEFAULT_PIPELINE_ID,
    name: "IB Sales Pipeline",
    stages: DEFAULT_PIPELINE_STAGES,
    is_default: true,
    created_at: now,
  };
}

export const STAGE_TO_LEAD_STATUS: Record<string, string> = {
  "stage-new": "new",
  "stage-contacted": "contacted",
  "stage-qualified": "qualified",
  "stage-negotiation": "negotiating",
  "stage-deposited": "deposited",
  "stage-active": "active",
};
