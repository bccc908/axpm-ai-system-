import type { Channel } from "@/types/database";

export type CrmLeadRecordStatus =
  | "new"
  | "contacted"
  | "qualified"
  | "unqualified"
  | "converted";

export interface CrmLead {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  whatsapp: string | null;
  wechat: string | null;
  company: string | null;
  title: string | null;
  source: string | null;
  channel: Channel | null;
  status: CrmLeadRecordStatus;
  assigned_to: string | null;
  notes: string | null;
  client_id: string | null;
  account_id: string | null;
  deal_id: string | null;
  converted_at: string | null;
  custom_fields: Record<string, string>;
  created_at: string;
  updated_at: string;
}

export interface CrmAccount {
  id: string;
  name: string;
  website: string | null;
  phone: string | null;
  industry: string | null;
  notes: string | null;
  assigned_to: string | null;
  custom_fields: Record<string, string>;
  created_at: string;
  updated_at: string;
}

export interface ConvertLeadResult {
  lead: CrmLead;
  client_id: string;
  account_id: string;
  deal_id: string;
}
