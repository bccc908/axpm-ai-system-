-- Personal finance tables (optional — app uses local JSON file by default)

create table finance_transactions (
  id uuid primary key default uuid_generate_v4(),
  type text not null check (type in ('income', 'expense')),
  amount numeric(12, 2) not null,
  currency text not null default 'MYR',
  category text not null,
  description text not null default '',
  account text not null default 'cash',
  transaction_date date not null default current_date,
  created_at timestamptz not null default now()
);

create table payment_reminders (
  id uuid primary key default uuid_generate_v4(),
  title text not null,
  amount numeric(12, 2),
  currency text not null default 'MYR',
  due_day integer not null check (due_day between 1 and 31),
  category text not null default 'other' check (
    category in ('credit_card', 'bank_loan', 'mortgage', 'utility', 'subscription', 'insurance', 'other')
  ),
  notes text,
  last_paid_at timestamptz,
  remind_days_before integer not null default 3,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index finance_transactions_date_idx on finance_transactions(transaction_date desc);
create index finance_transactions_type_idx on finance_transactions(type);
create index payment_reminders_due_day_idx on payment_reminders(due_day);

alter table finance_transactions enable row level security;
alter table payment_reminders enable row level security;
