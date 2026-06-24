import type { Channel } from "@/types/database";

export type ActivityType =
  | "note"
  | "call"
  | "email"
  | "meeting"
  | "message"
  | "status_change"
  | "follow_up"
  | "deal_update"
  | "task"
  | "web_chat";

export type DealStatus = "open" | "won" | "lost";

export interface CrmPipelineStage {
  id: string;
  name: string;
  order: number;
  probability: number;
  color: string;
}

export interface CrmPipeline {
  id: string;
  name: string;
  stages: CrmPipelineStage[];
  is_default: boolean;
  created_at: string;
}

export interface CrmDeal {
  id: string;
  client_id: string;
  pipeline_id: string;
  stage_id: string;
  title: string;
  amount: number;
  currency: string;
  probability: number;
  status: DealStatus;
  close_date: string | null;
  source: string | null;
  notes: string | null;
  assigned_to: string | null;
  created_at: string;
  updated_at: string;
}

export interface CrmActivity {
  id: string;
  client_id: string;
  deal_id: string | null;
  type: ActivityType;
  title: string;
  body: string | null;
  channel: Channel | null;
  actor_name: string | null;
  metadata: Record<string, string | number | boolean | null>;
  occurred_at: string;
  created_at: string;
}

export interface CrmTimelineItem {
  id: string;
  kind: "activity" | "message" | "follow_up";
  type: string;
  title: string;
  body: string | null;
  channel: Channel | null;
  actor_name: string | null;
  occurred_at: string;
}

export interface CrmBoardColumn {
  stage: CrmPipelineStage;
  deals: (CrmDeal & { client_name: string })[];
}
