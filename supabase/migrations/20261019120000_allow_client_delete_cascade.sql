-- "Excluir Cliente" failed: deleting a client cascades to her contract's
-- payment lines, and the frozen-plan guard refused to delete lines of a
-- signed plan. Deletions coming from a cascade (whole client/contract
-- removed) are now allowed; direct edits/deletes of signed lines stay
-- blocked exactly as before.
create or replace function public.enforce_frozen_payment_plan_lines()
returns trigger language plpgsql security definer set search_path to 'public' as $function$
declare
  v_status text;
begin
  if tg_op = 'DELETE' and pg_trigger_depth() > 1 then
    return old;
  end if;
  select status into v_status from payment_plan_versions where id = coalesce(old.payment_plan_version_id, new.payment_plan_version_id);
  if v_status is not null and v_status <> 'draft' then
    raise exception 'Esta versão do plano de pagamento já foi assinada e não pode ser alterada diretamente — use renegotiate_payment_plan.';
  end if;
  return coalesce(new, old);
end;
$function$;
