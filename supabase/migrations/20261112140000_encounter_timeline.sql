-- Linha do tempo dos encontros (E1–E8) — admin, assistente e aluna.
--
-- 1) Corrige o checklist de preparação de E2/E4. Em 28/10 os textos
--    (purpose) de E2 e E4 trocaram de lugar (20261028150000), mas o
--    checklist ficou para trás: E2 pedia "Kit Digital pronto / ensaio
--    fotográfico" (que é do E4) e E4 pedia "Pesquisa de Precificação
--    respondida" (que é do E2). Aqui eles voltam a bater com cada encontro.
update public.encounter_prep_checklist_items
set encounter_number = case encounter_number when 2 then 4 when 4 then 2 end
where encounter_number in (2, 4);

-- 2) Lição de casa de cada encontro: quais atividades do app a aluna
--    conclui ANTES daquele encontro. É um checklist (sem bloqueio): o app
--    mostra o que falta, mas nunca impede de marcar ou fazer o encontro.
--    Quando a Nay muda a ordem dos encontros de uma aluna, a lição de casa
--    vai junto (está presa ao encontro, não à posição).
create table if not exists public.encounter_homework_defs (
  id uuid primary key default gen_random_uuid(),
  encounter_number integer not null references public.encounter_defs(number) on update cascade on delete cascade,
  activity_slug text not null references public.program_activities(slug) on update cascade on delete cascade,
  sort_order integer not null default 0,
  unique (encounter_number, activity_slug)
);
alter table public.encounter_homework_defs enable row level security;
create policy encounter_homework_defs_read on public.encounter_homework_defs
  for select using ((select auth.role()) = 'authenticated');
create policy encounter_homework_defs_admin_write on public.encounter_homework_defs
  for all using (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin'))
  with check (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin'));

insert into public.encounter_homework_defs (encounter_number, activity_slug, sort_order) values
  (1, 'brand-extraction', 0),   -- Diagnóstico Estratégico de Entrada
  (1, 'archetype-test', 1),     -- Teste de Arquétipos
  (2, 'business-survey', 0),    -- Pesquisa de Precificação ("direciona o seu Encontro 2")
  (3, 'activity-guide', 0),     -- Análise da Imagem Atual
  (3, 'initial-images', 1),     -- Upload das Imagens ("antes do E3")
  (3, 'brand-direction', 2),    -- Direção da Marca
  (4, 'pitch', 0),
  (4, 'content', 1),
  (5, 'business', 0)            -- Análise de Negócio (pré-requisito do E5)
on conflict (encounter_number, activity_slug) do nothing;

-- 3) Plano de encontros de cada aluna, definido pela Nay:
--    encounter_order   — a ordem dos encontros só desta aluna (ex.: {1,3,2,4}).
--                        null = ordem padrão (E1, E2, E3…).
--    current_encounter — "ela está no E3 agora": sobrepõe a posição
--                        calculada automaticamente (encontros individuais
--                        realizados). null = automático.
-- Tabela à parte (e não colunas em clients) porque a aluna pode editar a
-- própria linha de clients; esta só a Nay escreve.
create table if not exists public.client_encounter_plans (
  client_id uuid primary key references public.clients(id) on delete cascade,
  encounter_order integer[],
  current_encounter integer references public.encounter_defs(number) on update cascade on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now()
);
alter table public.client_encounter_plans enable row level security;
create policy client_encounter_plans_admin_all on public.client_encounter_plans
  for all using (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin'))
  with check (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin'));
create policy client_encounter_plans_assistant_read on public.client_encounter_plans
  for select using (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'assistant'));
create policy client_encounter_plans_client_read on public.client_encounter_plans
  for select using (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'client' and p.client_id = client_encounter_plans.client_id));
