-- =============================================================================
-- 0002: Remove "Credit Card" as a payment method.
-- Run once in: Supabase Dashboard -> SQL Editor -> New query -> Run
-- Existing "Credit Card" expenses are moved to "Debit / Bank" so no rows break
-- the new constraint. Change the target below if you prefer a different method.
-- =============================================================================

update public.expenses
   set payment_method = 'Debit / Bank'
 where payment_method = 'Credit Card';

alter table public.expenses drop constraint if exists expenses_payment_method_check;

alter table public.expenses
  add constraint expenses_payment_method_check
  check (payment_method in ('Cash', 'GCash / E-Wallet', 'Debit / Bank'));

-- Default for new rows (no-op if already 'Cash').
alter table public.expenses alter column payment_method set default 'Cash';
