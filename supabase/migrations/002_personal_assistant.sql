-- Personal assistant tables (optional — app uses local JSON file by default)

create table personal_jobs (
  id uuid primary key default uuid_generate_v4(),
  title text not null,
  description text,
  category text not null default 'general',
  priority text not null default 'medium' check (priority in ('low', 'medium', 'high')),
  status text not null default 'todo' check (status in ('todo', 'in_progress', 'done', 'cancelled')),
  due_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table work_logs (
  id uuid primary key default uuid_generate_v4(),
  title text not null,
  content text not null default '',
  category text not null default 'general',
  duration_minutes integer,
  logged_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table plan_entries (
  id uuid primary key default uuid_generate_v4(),
  title text not null,
  period text not null default 'daily' check (period in ('daily', 'weekly')),
  plan_date date not null,
  notes text,
  items jsonb not null default '[]',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index personal_jobs_status_idx on personal_jobs(status);
create index personal_jobs_due_at_idx on personal_jobs(due_at);
create index work_logs_logged_at_idx on work_logs(logged_at desc);
create index plan_entries_plan_date_idx on plan_entries(plan_date desc);

alter table personal_jobs enable row level security;
alter table work_logs enable row level security;
alter table plan_entries enable row level security;
