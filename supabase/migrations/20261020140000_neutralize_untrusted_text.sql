-- Security audit Step 2 (stored XSS): text typed by students or sent from
-- the public forms is shown on Nay's and the assistant's screens. Many of
-- those screens build HTML from it, so a value like <img onerror=...> could
-- run code in a staff browser. This guard makes such text inert at the
-- source, for every screen at once:
--   <  →  ‹      >  →  ›      "  →  “ / ” (typographic quotes, like phones type)
-- It only touches writes that don't come from staff (students, and the
-- public-form edge functions using the service role), and on UPDATE only
-- the fields that actually changed, so existing text is never rewritten.
create or replace function private.neutralize_text(t text)
returns text language sql immutable security definer set search_path = '' as $$
  select replace(
           regexp_replace(
             replace(replace(t, '<', '‹'), '>', '›'),
             '(^|[[:space:]([{])"', '\1“', 'g'),
           '"', '”')
$$;

create or replace function private.neutralize_jsonb(v jsonb)
returns jsonb language plpgsql immutable security definer set search_path = '' as $$
begin
  case jsonb_typeof(v)
    when 'string' then return to_jsonb(private.neutralize_text(v #>> '{}'));
    when 'array' then
      return coalesce((select jsonb_agg(private.neutralize_jsonb(e) order by i) from jsonb_array_elements(v) with ordinality as a(e, i)), '[]'::jsonb);
    when 'object' then
      return coalesce((select jsonb_object_agg(k, private.neutralize_jsonb(e)) from jsonb_each(v) as o(k, e)), '{}'::jsonb);
    else return v;
  end case;
end;
$$;

create or replace function private.neutralize_untrusted_text()
returns trigger language plpgsql security definer set search_path = '' as $$
-- security definer: students' accounts have no access to the private schema,
-- so the role check below must run as the function owner.
declare
  n jsonb := to_jsonb(new);
  o jsonb := case when tg_op = 'UPDATE' then to_jsonb(old) else '{}'::jsonb end;
  k text; v jsonb; changed boolean := false;
begin
  if (select private.current_user_role()) in ('admin', 'assistant') then return new; end if;
  for k, v in select * from jsonb_each(n) loop
    if jsonb_typeof(v) in ('string', 'array', 'object')
       and (tg_op = 'INSERT' or v is distinct from o -> k)
       and v::text ~ '[<>]|\\"' then
      n := jsonb_set(n, array[k], private.neutralize_jsonb(v));
      changed := true;
    end if;
  end loop;
  if changed then new := jsonb_populate_record(new, n); end if;
  return new;
end;
$$;

do $$
declare t text;
begin
  foreach t in array array[
    -- written by students
    'archetype_quiz_attempts','archetype_quiz_responses','business_survey_responses','business_surveys',
    'client_archetype_settings','clients','content_activities','encounter_requests','homework_submissions',
    'homework_tasks','images','meeting_requests','party_info','payment_invoices','playbook_experiences',
    'playbook_quiz_results','premium_upgrade_interests','profiles','questionnaire_questions','questionnaires',
    'resource_assignments','value_assessment_answers_s1','value_assessment_answers_s2','value_assessment_answers_s3',
    'value_assessment_answers_s4','value_assessment_answers_s5','value_assessment_answers_s6','value_assessments',
    'value_fixed_costs','value_offers','value_references','value_variable_costs',
    -- written by the public forms (edge functions)
    'event_registrations','leads','mentee_results','value_perception_diagnostics','client_activity_log'
  ] loop
    execute format('create trigger a_neutralize_untrusted_text before insert or update on public.%I
                    for each row execute function private.neutralize_untrusted_text()', t);
  end loop;
end $$;
