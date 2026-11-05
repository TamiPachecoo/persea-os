-- A receipt must always land on the plan that is in force. A page left
-- open while the plan was edited once recorded Carla's R$ 12.000 card
-- charge against a superseded version, so the current plan showed it as
-- unpaid. renegotiate_payment_plan moves allocations onto the new active
-- lines, which this still allows.
create or replace function private.enforce_allocation_active_line()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not exists (
    select 1 from contract_payment_lines l
    join payment_plan_versions v on v.id = l.payment_plan_version_id
    where l.id = new.payment_line_id and v.status = 'active'
  ) then
    raise exception 'O plano de pagamento foi atualizado. Recarregue a página e registre de novo.';
  end if;
  return new;
end $$;

drop trigger if exists trg_allocation_active_line on payment_allocations;
create trigger trg_allocation_active_line
  before insert or update of payment_line_id on payment_allocations
  for each row execute function private.enforce_allocation_active_line();
