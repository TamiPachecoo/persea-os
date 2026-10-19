-- Per-client journey: phases a client skips (0-based like phase_index;
-- [1] = Fase 2 · Imagem e estratégia). Set by Nay on the client's page
-- (Jornada → "Fases da jornada dela"). The client herself can't change it
-- (added to enforce_client_brand_ideas_only_update's protected columns —
-- applied with the function's full body in production).
alter table public.clients add column if not exists skipped_phases smallint[] not null default '{}';
-- Nayara Namorato goes from Fase 1 straight to Fase 3 (Oct 2026).
update public.clients set skipped_phases = '{1}' where id = '690bcbdc-656a-4257-8459-86109e0c58bb';
