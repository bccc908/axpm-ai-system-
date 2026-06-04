-- AXPM AI Operation System — initial schema

create extension if not exists "uuid-ossp";

-- Team members
create table team_members (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  email text unique not null,
  role text not null default 'agent' check (role in ('admin', 'manager', 'agent')),
  telegram_id text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- Clients
create table clients (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  email text,
  phone text,
  whatsapp text,
  wechat text,
  lead_status text not null default 'new' check (
    lead_status in ('new', 'contacted', 'qualified', 'negotiating', 'deposited', 'active', 'dormant', 'lost')
  ),
  deposit_amount numeric(12, 2) not null default 0,
  deposit_currency text not null default 'USD',
  ib_source text,
  tags text[] not null default '{}',
  assigned_to uuid references team_members(id) on delete set null,
  notes text,
  next_follow_up_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index clients_lead_status_idx on clients(lead_status);
create index clients_next_follow_up_idx on clients(next_follow_up_at);
create index clients_assigned_to_idx on clients(assigned_to);

-- Follow-ups
create table follow_ups (
  id uuid primary key default uuid_generate_v4(),
  client_id uuid not null references clients(id) on delete cascade,
  team_member_id uuid references team_members(id) on delete set null,
  channel text not null check (channel in ('whatsapp', 'wechat', 'telegram', 'email', 'phone')),
  summary text,
  notes text not null default '',
  scheduled_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create index follow_ups_client_id_idx on follow_ups(client_id);
create index follow_ups_scheduled_at_idx on follow_ups(scheduled_at);

-- Reminders
create table reminders (
  id uuid primary key default uuid_generate_v4(),
  client_id uuid references clients(id) on delete cascade,
  team_member_id uuid references team_members(id) on delete set null,
  title text not null,
  message text not null,
  channel text not null check (channel in ('telegram', 'whatsapp')),
  scheduled_at timestamptz not null,
  sent_at timestamptz,
  created_at timestamptz not null default now()
);

create index reminders_scheduled_at_idx on reminders(scheduled_at) where sent_at is null;

-- Team tasks
create table team_tasks (
  id uuid primary key default uuid_generate_v4(),
  title text not null,
  description text,
  assigned_to uuid references team_members(id) on delete set null,
  status text not null default 'pending' check (status in ('pending', 'in_progress', 'done', 'cancelled')),
  due_at timestamptz,
  created_at timestamptz not null default now()
);

-- AI conversation summaries
create table conversation_summaries (
  id uuid primary key default uuid_generate_v4(),
  client_id uuid not null references clients(id) on delete cascade,
  channel text not null check (channel in ('whatsapp', 'wechat', 'telegram', 'email', 'phone')),
  summary text not null,
  recommendations text[] not null default '{}',
  created_at timestamptz not null default now()
);

-- Daily reports
create table daily_reports (
  id uuid primary key default uuid_generate_v4(),
  report_date date not null unique,
  content text not null,
  metrics jsonb not null default '{}',
  created_at timestamptz not null default now()
);

-- Auto-update clients.updated_at
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger clients_updated_at
  before update on clients
  for each row execute function update_updated_at();

-- Row Level Security (enable after auth setup)
alter table team_members enable row level security;
alter table clients enable row level security;
alter table follow_ups enable row level security;
alter table reminders enable row level security;
alter table team_tasks enable row level security;
alter table conversation_summaries enable row level security;
alter table daily_reports enable row level security;

-- Seed demo data (optional — remove in production)
insert into team_members (name, email, role) values
  ('Admin', 'admin@axpm.com', 'admin'),
  ('Sales Agent', 'sales@axpm.com', 'agent');

insert into clients (name, email, phone, whatsapp, lead_status, deposit_amount, ib_source, tags, next_follow_up_at) values
  ('John Chen', 'john@example.com', '+85291234567', '+85291234567', 'qualified', 5000, 'IB-001', array['vip', 'china'], now() + interval '1 day'),
  ('Sarah Wong', 'sarah@example.com', '+85298765432', '+85298765432', 'contacted', 0, 'IB-002', array['new-lead'], now() + interval '2 days'),
  ('Michael Lee', 'michael@example.com', null, null, 'deposited', 25000, 'IB-001', array['high-value'], now() + interval '3 hours');
