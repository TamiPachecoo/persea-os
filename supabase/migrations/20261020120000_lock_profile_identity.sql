-- Security audit (Oct 2026), Step 1: profiles_self_update let a signed-in
-- user change her own role (e.g. client -> admin) or client_id (read another
-- student's data). No screen ever updates profiles; accounts are created
-- and linked only by the invite functions with the service-role key.
-- So: requests made with a normal login (authenticated / anon) can't change
-- id, role, client_id or email. Service role and the dashboard still can.
create or replace function private.enforce_profile_identity_locked()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user in ('authenticated', 'anon') and (
       new.id is distinct from old.id
    or new.role is distinct from old.role
    or new.client_id is distinct from old.client_id
    or new.email is distinct from old.email
  ) then
    raise exception 'Não é permitido alterar o perfil de acesso, o vínculo com a cliente ou o e-mail da conta.'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_identity_locked on public.profiles;
create trigger profiles_identity_locked
  before update on public.profiles
  for each row execute function private.enforce_profile_identity_locked();
