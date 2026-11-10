-- Relatórios de engajamento na aba Clientes: para cada cliente, o último
-- acesso à plataforma e as ações dela mesma (fotos e tarefas enviadas,
-- questionários e testes concluídos, pedidos de encontro, respostas a
-- convites de encontro), mais o último e o próximo encontro. Só a equipe
-- (admin/assistente) pode chamar; lê auth.users para o último login.
create or replace function public.client_engagement()
returns table (
  client_id uuid, last_login timestamptz, last_action timestamptz,
  actions_30d integer, last_meeting timestamptz, next_meeting timestamptz
)
language sql stable security definer set search_path = public, auth as $$
  with staff as (
    select 1 from profiles p where p.id = auth.uid() and p.role in ('admin', 'assistant')
  ),
  acts as (
    select i.client_id, i.uploaded_at as at from images i
    union all select t.client_id, s.uploaded_at from homework_submissions s join homework_tasks t on t.id = s.homework_task_id
    union all select a.client_id, a.completed_at from archetype_quiz_attempts a where a.completed_at is not null
    union all select b.client_id, b.submitted_at from business_surveys b where b.submitted_at is not null
    union all select v.client_id, v.submitted_at from value_assessments v where v.submitted_at is not null
    union all select m.client_id, m.created_at from meeting_requests m
    union all select e.client_id, e.responded_at from encounter_requests e where e.responded_at is not null
  )
  select c.id,
    (select max(u.last_sign_in_at) from profiles p join auth.users u on u.id = p.id where p.client_id = c.id and p.role = 'client'),
    (select max(a.at) from acts a where a.client_id = c.id),
    (select count(*)::int from acts a where a.client_id = c.id and a.at >= now() - interval '30 days'),
    (select max(ai.item_date) from agenda_items ai where ai.related_student_id = c.id and ai.status = 'completed'),
    (select min(ai.item_date) from agenda_items ai where ai.related_student_id = c.id and ai.status = 'upcoming' and ai.item_date >= now())
  from clients c
  where exists (select 1 from staff);
$$;
revoke all on function public.client_engagement() from public, anon;
grant execute on function public.client_engagement() to authenticated;
