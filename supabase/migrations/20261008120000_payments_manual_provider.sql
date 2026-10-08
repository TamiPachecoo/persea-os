-- Money received outside SumUp (bank transfer, PIX straight to Nay's key,
-- boleto) and confirmed by hand in the client workspace ("Marcar como
-- recebida") is real revenue. It used to be saved as provider 'mock' — the
-- test-mode tag — so every total and report left it out. It now has its
-- own provider, 'manual', and every payment records its method so reports
-- can break revenue down by PIX / cartão / transferência / boleto.
alter table public.payments drop constraint if exists payments_provider_check;
alter table public.payments add constraint payments_provider_check check (provider = any (array['sumup', 'mock', 'manual']));
alter table public.payments add column if not exists method text;

-- Backfill: method from the installment(s) each payment paid.
update public.payments p set method = (
  select l.method from public.payment_allocations a
  join public.contract_payment_lines l on l.id = a.payment_line_id
  where a.payment_id = p.id and l.method is not null limit 1)
where p.method is null;

-- Real (non-demo) receipts recorded by hand before this change were tagged
-- 'mock'; they are real money, so they move to 'manual'. Demo clients'
-- test rows stay 'mock'.
update public.payments p set provider = 'manual'
where p.provider = 'mock' and p.status = 'paid'
  and exists (select 1 from public.clients c where c.id = p.client_id and not c.is_demo);
