-- E3 / E4 materials (Projeto de Imagem):
--  * Nay chooses, per student, what E3 includes: client_encounter_plans.e3_items
--    (slugs of image_guides; null = the default: Cartela de Cores + Guia de
--    Produções). Ferramentas para Nova Imagem is no longer a default.
--  * Custom E3 items Nay adds carry their own name in image_guides.label.
--  * Ensaio Fotográfico (slug moodboard_ensaio) moves to E4 and takes a
--    Pinterest moodboard link next to the Canva link and the PDF.
--  * The student reads a guide only once Nay delivered it (was: whenever it
--    had a link — and an uploaded file without a link never showed).
alter table public.client_encounter_plans add column if not exists e3_items text[];
alter table public.image_guides add column if not exists label text;
alter table public.image_guides add column if not exists pinterest_url text;

drop policy if exists image_guides_client_read on public.image_guides;
create policy image_guides_client_read on public.image_guides
  for select to authenticated
  using (delivered_at is not null and exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.role = 'client' and p.client_id = image_guides.client_id));
