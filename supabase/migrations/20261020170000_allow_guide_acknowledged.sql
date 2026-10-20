-- Security audit side-finding: "Já consultei o guia" (clients.
-- guide_acknowledged) is ticked by the student herself, but the clients
-- self-update guard listed it among the protected columns, so the tick was
-- always refused. Same guard, minus that one column.
create or replace function public.enforce_client_brand_ideas_only_update()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  acting_role public.user_role;
begin
  select role into acting_role from public.profiles where id = auth.uid();
  if acting_role = 'client' then
    if row(new.*) is distinct from row(old.*) then
      -- Every column except brand_ideas/guide_acknowledged/updated_at must be unchanged.
      if new.id is distinct from old.id or new.legacy_id is distinct from old.legacy_id
        or new.full_name is distinct from old.full_name or new.email is distinct from old.email
        or new.status is distinct from old.status or new.tier is distinct from old.tier
        or new.phase_index is distinct from old.phase_index or new.program_slug is distinct from old.program_slug
        or new.gender is distinct from old.gender or new.access_status is distinct from old.access_status
        or new.photo_url is distinct from old.photo_url or new.notes is distinct from old.notes
        or new.image_project_status is distinct from old.image_project_status
        or new.images_status is distinct from old.images_status or new.images_note is distinct from old.images_note
        or new.personal_playbook_url is distinct from old.personal_playbook_url
        or new.personal_playbook_delivered_at is distinct from old.personal_playbook_delivered_at
        or new.business_playbook_url is distinct from old.business_playbook_url
        or new.business_playbook_delivered_at is distinct from old.business_playbook_delivered_at
        or new.hubla_access_status is distinct from old.hubla_access_status
        or new.hubla_access_granted_at is distinct from old.hubla_access_granted_at
        or new.is_demo is distinct from old.is_demo
        or new.skipped_phases is distinct from old.skipped_phases
      then
        raise exception 'clients: apenas brand_ideas pode ser atualizado por uma cliente';
      end if;
    end if;
  end if;
  return new;
end;
$function$;
