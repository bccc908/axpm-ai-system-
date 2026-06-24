-- AXPM CRM + Inbox extensions (Zoho-style CRM, LivePerson inbox, widget chat)
-- Run after 001_initial_schema.sql when migrating to Supabase

-- App settings (mirrors data/settings.json)
create table if not exists app_settings (
  id text primary key default 'default',
  payload jsonb not null default '{}',
  updated_at timestamptz not null default now()
);

-- CRM leads (Zoho)
create table if not exists crm_leads (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  email text,
  phone text,
  whatsapp text,
  wechat text,
  company text,
  title text,
  source text,
  channel text,
  status text not null default 'new',
  assigned_to uuid references team_members(id) on delete set null,
  notes text,
  client_id uuid references clients(id) on delete set null,
  account_id uuid,
  deal_id uuid,
  converted_at timestamptz,
  custom_fields jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists crm_leads_status_idx on crm_leads(status);
create index if not exists crm_leads_client_id_idx on crm_leads(client_id);

-- CRM accounts
create table if not exists crm_accounts (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  website text,
  phone text,
  industry text,
  notes text,
  assigned_to uuid references team_members(id) on delete set null,
  custom_fields jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- CRM pipelines
create table if not exists crm_pipelines (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  stages jsonb not null default '[]',
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);

-- CRM deals
create table if not exists crm_deals (
  id uuid primary key default uuid_generate_v4(),
  client_id uuid not null references clients(id) on delete cascade,
  pipeline_id uuid references crm_pipelines(id) on delete set null,
  stage_id text not null,
  title text not null,
  amount numeric(14, 2) not null default 0,
  currency text not null default 'MYR',
  probability integer not null default 0,
  status text not null default 'open' check (status in ('open', 'won', 'lost')),
  close_date timestamptz,
  source text,
  notes text,
  assigned_to uuid references team_members(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists crm_deals_client_id_idx on crm_deals(client_id);
create index if not exists crm_deals_status_idx on crm_deals(status);

-- CRM activities (timeline)
create table if not exists crm_activities (
  id uuid primary key default uuid_generate_v4(),
  client_id uuid not null references clients(id) on delete cascade,
  deal_id uuid references crm_deals(id) on delete set null,
  type text not null,
  title text not null,
  body text,
  channel text,
  actor_name text,
  metadata jsonb not null default '{}',
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists crm_activities_client_id_idx on crm_activities(client_id);

-- Conversation messages (mirrors data/conversations.json)
create table if not exists conversation_messages (
  id uuid primary key default uuid_generate_v4(),
  client_id uuid references clients(id) on delete set null,
  client_name text,
  wechat_id text,
  channel text not null,
  direction text not null check (direction in ('inbound', 'outbound')),
  sender_label text not null,
  content text not null,
  source text,
  external_id text,
  sent_at timestamptz not null default now()
);

create index if not exists conversation_messages_client_id_idx on conversation_messages(client_id);
create index if not exists conversation_messages_sent_at_idx on conversation_messages(sent_at desc);

-- Inbox sessions (LivePerson-style handoff)
create table if not exists inbox_sessions (
  id uuid primary key default uuid_generate_v4(),
  client_id uuid references clients(id) on delete set null,
  client_name text,
  channel text not null,
  status text not null default 'bot' check (status in ('bot', 'human', 'closed')),
  assigned_to uuid references team_members(id) on delete set null,
  wechat_id text,
  last_message_at timestamptz,
  last_preview text,
  unread_count integer not null default 0,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists inbox_sessions_status_idx on inbox_sessions(status);
create index if not exists inbox_sessions_client_id_idx on inbox_sessions(client_id);

-- CRM workflow rules (optional — also stored in app_settings.crmWorkflows)
create table if not exists crm_workflows (
  id text primary key,
  name text not null,
  enabled boolean not null default true,
  trigger text not null,
  trigger_value text not null,
  action text not null,
  task_title text not null default '',
  telegram_message text,
  created_at timestamptz not null default now()
);
