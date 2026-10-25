-- Anonymous feedback after the PERSEA Experience (app.naymurta.com/feedback.html,
-- via the event-feedback Edge Function). No name, contact or IP is stored.
-- Staff-only; summarised in the CRM's Eventos tab.
create table public.event_feedback (
  id uuid primary key default gen_random_uuid(),
  event_slug text not null default 'persea-experience',
  overall smallint check (overall between 1 and 5),
  recommend smallint check (recommend between 0 and 10),
  location smallint check (location between 1 and 5),
  food smallint check (food between 1 and 5),
  organization smallint check (organization between 1 and 5),
  value_for_money smallint check (value_for_money between 1 and 5),
  price_perception text check (price_perception in ('barato', 'justo', 'caro')),
  talk_posicionamento smallint check (talk_posicionamento between 1 and 5),
  talk_capital_visual smallint check (talk_capital_visual between 1 and 5),
  talk_visibilidade smallint check (talk_visibilidade between 1 and 5),
  talk_vendas smallint check (talk_vendas between 1 and 5),
  talk_larissa smallint check (talk_larissa between 1 and 5),
  talk_rejane smallint check (talk_rejane between 1 and 5),
  favorite_talk text check (favorite_talk in ('posicionamento', 'capital_visual', 'visibilidade', 'vendas', 'larissa', 'rejane')),
  wish_more text[] not null default '{}',
  wish_more_other text,
  location_note text,
  food_note text,
  highlight text,
  improve text,
  suggestions text,
  created_at timestamptz not null default now()
);
alter table public.event_feedback enable row level security;
create policy event_feedback_staff_all on public.event_feedback for all
  using (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role in ('admin', 'assistant')))
  with check (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role in ('admin', 'assistant')));
create trigger a_neutralize_untrusted_text before insert or update on public.event_feedback
  for each row execute function private.neutralize_untrusted_text();
create trigger b_limit_public_form_flood before insert on public.event_feedback
  for each row execute function private.limit_public_form_flood(80);
