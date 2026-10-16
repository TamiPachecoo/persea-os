-- Nay edits the contract; the assistant moves it forward to signing only
-- after Nay marked it reviewed. admin_reviewed_at/by: set only by admin.
-- Any text change made by someone other than Nay (e.g. the text being
-- regenerated after the assistant revises the commercial terms) clears
-- the mark, so what goes out is always what Nay last saw. Server-side
-- calls without a user (service role) are left alone.
alter table public.contracts
  add column if not exists admin_reviewed_at timestamptz,
  add column if not exists admin_reviewed_by uuid references public.profiles(id) on delete set null;

create or replace function public.contracts_admin_review_guard()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  caller_role public.user_role;
begin
  if auth.uid() is null then
    return new;
  end if;
  select role into caller_role from public.profiles where id = auth.uid();
  if new.admin_reviewed_at is distinct from old.admin_reviewed_at
     and new.admin_reviewed_at is not null
     and caller_role is distinct from 'admin' then
    raise exception 'Apenas a Nay pode marcar o contrato como revisado.';
  end if;
  if new.body_text is distinct from old.body_text and caller_role is distinct from 'admin' then
    new.admin_reviewed_at := null;
    new.admin_reviewed_by := null;
  end if;
  return new;
end;
$$;
revoke all on function public.contracts_admin_review_guard() from public, anon, authenticated;

drop trigger if exists trg_contracts_admin_review_guard on public.contracts;
create trigger trg_contracts_admin_review_guard
  before update on public.contracts
  for each row execute function public.contracts_admin_review_guard();
