-- =============================================================================
-- 0003: Recurring expenses, savings goals, receipt photos.
-- Run once in: Supabase Dashboard -> SQL Editor -> New query -> Run
-- =============================================================================

-- Receipt photo path on each expense (file lives in the private "receipts" bucket).
alter table public.expenses add column if not exists receipt_path text;

-- ---------------------------------------------------------------- recurring
create table if not exists public.recurring_expenses (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid not null references auth.users(id) on delete cascade,
  category_id           uuid not null references public.categories(id) on delete restrict,
  amount                numeric(12,2) not null check (amount > 0),
  payment_method        text not null default 'Cash'
                        check (payment_method in ('Cash','GCash / E-Wallet','Debit / Bank')),
  note                  text not null default '' check (char_length(note) <= 200),
  day_of_month          int not null default 1 check (day_of_month between 1 and 28),
  active                boolean not null default true,
  last_generated_month  text check (last_generated_month is null or last_generated_month ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  created_at            timestamptz not null default now()
);

-- ------------------------------------------------------------------- goals
create table if not exists public.savings_goals (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  name        text not null check (char_length(trim(name)) between 1 and 60),
  target      numeric(12,2) not null check (target > 0),
  created_at  timestamptz not null default now()
);

grant select, insert, update, delete on public.recurring_expenses, public.savings_goals to authenticated;

alter table public.recurring_expenses enable row level security;
alter table public.savings_goals enable row level security;

do $$
declare t text;
begin
  foreach t in array array['recurring_expenses','savings_goals']
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

-- Logs every active recurring expense whose due date has arrived this month.
-- Only the current month is generated (no backfill). Runs as the caller (RLS applies).
create or replace function public.generate_recurring_expenses(p_current_month text, p_today date)
returns integer
language plpgsql
security invoker
set search_path = public
as $$
declare
  r        record;
  v_date   date;
  v_count  integer := 0;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  if p_current_month !~ '^\d{4}-(0[1-9]|1[0-2])$' then raise exception 'Invalid month'; end if;

  for r in
    select * from public.recurring_expenses
     where user_id = auth.uid()
       and active
       and (last_generated_month is null or last_generated_month < p_current_month)
  loop
    v_date := (p_current_month || '-' || lpad(r.day_of_month::text, 2, '0'))::date;
    -- Due today or earlier, and not before the recurring item was created.
    if v_date <= p_today and v_date >= r.created_at::date then
      insert into public.expenses (user_id, category_id, amount, payment_method, note, spent_on)
        values (r.user_id, r.category_id, r.amount, r.payment_method,
                case when r.note = '' then 'Recurring' else r.note end, v_date);
      update public.recurring_expenses set last_generated_month = p_current_month where id = r.id;
      v_count := v_count + 1;
    end if;
  end loop;
  return v_count;
end;
$$;

grant execute on function public.generate_recurring_expenses(text, date) to authenticated;

-- ------------------------------------------------------- receipts (storage)
insert into storage.buckets (id, name, public)
  values ('receipts', 'receipts', false)
  on conflict (id) do nothing;

-- Each user can only touch files inside their own folder: <user_id>/...
drop policy if exists "receipts_select_own" on storage.objects;
drop policy if exists "receipts_insert_own" on storage.objects;
drop policy if exists "receipts_update_own" on storage.objects;
drop policy if exists "receipts_delete_own" on storage.objects;
create policy "receipts_select_own" on storage.objects for select to authenticated
  using (bucket_id = 'receipts' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "receipts_insert_own" on storage.objects for insert to authenticated
  with check (bucket_id = 'receipts' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "receipts_update_own" on storage.objects for update to authenticated
  using (bucket_id = 'receipts' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "receipts_delete_own" on storage.objects for delete to authenticated
  using (bucket_id = 'receipts' and (storage.foldername(name))[1] = auth.uid()::text);
