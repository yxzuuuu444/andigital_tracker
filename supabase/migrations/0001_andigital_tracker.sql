-- =============================================================================
-- Andigital Tracker — Supabase schema, RLS, rollover logic, default seeding
-- Run once in: Supabase Dashboard -> SQL Editor -> New query -> Run
-- =============================================================================

create extension if not exists "pgcrypto";

-- -----------------------------------------------------------------------------
-- 1. TABLES
-- -----------------------------------------------------------------------------

-- Monthly allowance entries. 'base' = the month's starting allowance (one per
-- month); 'topup' / 'adjustment' / 'savings_transfer' = mid-month additions.
create table if not exists public.monthly_allowances (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  month       text not null check (month ~ '^\d{4}-(0[1-9]|1[0-2])$'),   -- YYYY-MM
  amount      numeric(12,2) not null check (amount >= 0),
  kind        text not null default 'base'
              check (kind in ('base','topup','adjustment','savings_transfer')),
  note        text,
  created_at  timestamptz not null default now()
);

create unique index if not exists monthly_allowances_one_base_per_month
  on public.monthly_allowances (user_id, month) where kind = 'base';
create index if not exists monthly_allowances_user_month
  on public.monthly_allowances (user_id, month);

-- Spending categories with per-category budget and enforcement mode.
create table if not exists public.categories (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  name          text not null check (char_length(trim(name)) between 1 and 40),
  icon          text not null default 'circle',          -- lucide icon key
  color         text not null default '#8B5CF6',
  monthly_limit numeric(12,2) check (monthly_limit is null or monthly_limit >= 0),
  limit_mode    text not null default 'soft_warn'
                check (limit_mode in ('soft_warn','hard_block')),
  sort_order    int not null default 0,
  created_at    timestamptz not null default now(),
  unique (user_id, name)
);
create index if not exists categories_user_sort on public.categories (user_id, sort_order);

create table if not exists public.expenses (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  category_id     uuid not null references public.categories(id) on delete restrict,
  amount          numeric(12,2) not null check (amount > 0),
  payment_method  text not null default 'Cash'
                  check (payment_method in ('Cash','GCash / E-Wallet','Debit / Bank','Credit Card')),
  note            text not null default '' check (char_length(note) <= 200),
  spent_on        date not null default current_date,
  over_budget_override boolean not null default false,
  created_at      timestamptz not null default now()
);
create index if not exists expenses_user_date on public.expenses (user_id, spent_on desc);
create index if not exists expenses_user_category on public.expenses (user_id, category_id);

-- Savings ledger: rollovers (credits), deposits (credits), withdrawals (debits).
create table if not exists public.savings_transactions (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  kind          text not null check (kind in ('rollover','deposit','withdrawal')),
  amount        numeric(12,2) not null check (amount > 0),
  note          text not null default '',
  source_month  text check (source_month is null or source_month ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  created_at    timestamptz not null default now()
);
-- A month can only ever roll over once (no double-credit).
create unique index if not exists savings_one_rollover_per_month
  on public.savings_transactions (user_id, source_month) where kind = 'rollover';
create index if not exists savings_user_created on public.savings_transactions (user_id, created_at desc);

-- Records that a month has been closed (rolled over). Prevents re-processing.
create table if not exists public.month_closures (
  user_id     uuid not null references auth.users(id) on delete cascade,
  month       text not null check (month ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  unspent     numeric(12,2) not null default 0,
  closed_at   timestamptz not null default now(),
  primary key (user_id, month)
);

-- Table privileges for signed-in users. Supabase grants these by default; stating them
-- keeps the migration self-contained. RLS below still decides which rows are visible.
grant usage on schema public to authenticated;
grant select, insert, update, delete on public.monthly_allowances, public.categories,
  public.expenses, public.savings_transactions, public.month_closures to authenticated;
revoke all on public.monthly_allowances, public.categories, public.expenses,
  public.savings_transactions, public.month_closures from anon;

-- -----------------------------------------------------------------------------
-- 2. ROW LEVEL SECURITY — every table, strictly auth.uid() = user_id
-- -----------------------------------------------------------------------------

alter table public.monthly_allowances    enable row level security;
alter table public.categories            enable row level security;
alter table public.expenses              enable row level security;
alter table public.savings_transactions  enable row level security;
alter table public.month_closures        enable row level security;

-- Drop-if-exists keeps the script re-runnable.
do $$
declare t text;
begin
  foreach t in array array['monthly_allowances','categories','expenses','savings_transactions']
  loop
    execute format('drop policy if exists "%1$s_select" on public.%1$s', t);
    execute format('drop policy if exists "%1$s_insert" on public.%1$s', t);
    execute format('drop policy if exists "%1$s_update" on public.%1$s', t);
    execute format('drop policy if exists "%1$s_delete" on public.%1$s', t);
    execute format('create policy "%1$s_select" on public.%1$s for select to authenticated using (auth.uid() = user_id)', t);
    execute format('create policy "%1$s_insert" on public.%1$s for insert to authenticated with check (auth.uid() = user_id)', t);
    execute format('create policy "%1$s_update" on public.%1$s for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id)', t);
    execute format('create policy "%1$s_delete" on public.%1$s for delete to authenticated using (auth.uid() = user_id)', t);
  end loop;
end $$;

-- month_closures is written only by run_month_rollovers (security invoker, so RLS still applies).
drop policy if exists "month_closures_select" on public.month_closures;
drop policy if exists "month_closures_insert" on public.month_closures;
drop policy if exists "month_closures_delete" on public.month_closures;
create policy "month_closures_select" on public.month_closures for select to authenticated using (auth.uid() = user_id);
create policy "month_closures_insert" on public.month_closures for insert to authenticated with check (auth.uid() = user_id);
create policy "month_closures_delete" on public.month_closures for delete to authenticated using (auth.uid() = user_id);

-- -----------------------------------------------------------------------------
-- 3. AUTO-SEED STARTER CATEGORIES FOR NEW USERS
-- -----------------------------------------------------------------------------

create or replace function public.seed_default_categories()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.categories (user_id, name, icon, color, sort_order) values
    (new.id, 'Food & Dining',       'utensils',       '#8B5CF6', 1),
    (new.id, 'Transport & Gas',     'fuel',           '#7C3AED', 2),
    (new.id, 'Bills & Utilities',   'receipt',        '#A78BFA', 3),
    (new.id, 'Personal & Shopping', 'shopping-bag',   '#C4B5FD', 4),
    (new.id, 'Dates & Leisure',     'heart',          '#DDD6FE', 5),
    (new.id, 'Miscellaneous',       'circle-ellipsis','#EDE9FE', 6)
  on conflict (user_id, name) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_seed_categories on auth.users;
create trigger on_auth_user_created_seed_categories
  after insert on auth.users
  for each row execute function public.seed_default_categories();

-- -----------------------------------------------------------------------------
-- 4. MONTH-END ROLLOVER
--    Called by the app on open with the client's current month (YYYY-MM).
--    Every unclosed month before p_current_month is closed exactly once:
--      unspent = allowance(month) - expenses(month)
--      if unspent > 0 -> savings credit "Rollover from <Mon YYYY>"
--    Runs as the caller (security invoker), so RLS limits it to their rows.
-- -----------------------------------------------------------------------------

create or replace function public.run_month_rollovers(p_current_month text)
returns integer
language plpgsql
security invoker
set search_path = public
as $$
declare
  uid        uuid := auth.uid();
  m          record;
  v_alloc    numeric(12,2);
  v_spent    numeric(12,2);
  v_unspent  numeric(12,2);
  v_label    text;
  v_count    integer := 0;
begin
  if uid is null then
    raise exception 'Not authenticated';
  end if;
  if p_current_month !~ '^\d{4}-(0[1-9]|1[0-2])$' then
    raise exception 'Invalid month: %', p_current_month;
  end if;

  -- Every month that has data but is not yet closed, strictly before the current month.
  for m in
    select distinct month from (
      select month from public.monthly_allowances where user_id = uid
      union
      select to_char(spent_on, 'YYYY-MM') from public.expenses where user_id = uid
    ) src
    where month < p_current_month
      and not exists (
        select 1 from public.month_closures c where c.user_id = uid and c.month = src.month
      )
    order by month
  loop
    select coalesce(sum(amount), 0) into v_alloc
      from public.monthly_allowances
      where user_id = uid and month = m.month;

    select coalesce(sum(amount), 0) into v_spent
      from public.expenses
      where user_id = uid
        and spent_on >= (m.month || '-01')::date
        and spent_on <  ((m.month || '-01')::date + interval '1 month');

    v_unspent := v_alloc - v_spent;

    insert into public.month_closures (user_id, month, unspent)
      values (uid, m.month, v_unspent);

    if v_unspent > 0 then
      v_label := to_char((m.month || '-01')::date, 'Mon YYYY');
      insert into public.savings_transactions (user_id, kind, amount, note, source_month)
        values (uid, 'rollover', v_unspent, 'Rollover from ' || v_label, m.month)
        on conflict do nothing;
    end if;

    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

-- -----------------------------------------------------------------------------
-- 5. SAVINGS WITHDRAWAL (atomic)
--    p_destination = 'expense'  -> logs an expense from savings
--    p_destination = 'allowance'-> moves money into p_current_month's allowance
-- -----------------------------------------------------------------------------

create or replace function public.withdraw_savings(
  p_amount        numeric,
  p_note          text,
  p_destination   text,
  p_category_id   uuid,
  p_payment       text,
  p_current_month text,
  p_spent_on      date default current_date   -- client-local date (avoids UTC drift)
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  uid     uuid := auth.uid();
  v_bal   numeric(12,2);
begin
  if uid is null then raise exception 'Not authenticated'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'Amount must be positive'; end if;
  if p_destination not in ('expense','allowance') then raise exception 'Bad destination'; end if;

  select coalesce(sum(case when kind = 'withdrawal' then -amount else amount end), 0)
    into v_bal
    from public.savings_transactions where user_id = uid;

  if p_amount > v_bal then
    raise exception 'Insufficient savings (balance %)', v_bal;
  end if;

  insert into public.savings_transactions (user_id, kind, amount, note)
    values (uid, 'withdrawal', p_amount,
            coalesce(nullif(trim(p_note), ''),
                     case when p_destination = 'expense' then 'Used for expense' else 'Moved to allowance' end));

  if p_destination = 'expense' then
    insert into public.expenses (user_id, category_id, amount, payment_method, note, spent_on)
      values (uid, p_category_id, p_amount, coalesce(p_payment, 'Cash'),
              coalesce(nullif(trim(p_note), ''), 'From savings'), coalesce(p_spent_on, current_date));
  else
    insert into public.monthly_allowances (user_id, month, amount, kind, note)
      values (uid, p_current_month, p_amount, 'savings_transfer',
              coalesce(nullif(trim(p_note), ''), 'From savings'));
  end if;
end;
$$;

-- Helpful grants (Supabase grants these by default; kept explicit for clarity).
grant execute on function public.run_month_rollovers(text) to authenticated;
grant execute on function public.withdraw_savings(numeric, text, text, uuid, text, text, date) to authenticated;
