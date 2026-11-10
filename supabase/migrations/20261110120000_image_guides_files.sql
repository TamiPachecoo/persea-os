-- Deliverables of the Projeto de Imagem (Cartela de Cores, Guias de
-- Produções, Ferramentas para Nova Imagem, Ensaio) can carry an uploaded
-- file, not only a link — same as positioning_guides / digital_kits. The
-- file lives in the private client-shared-files bucket under
-- <client_id>/materials/, readable by that client and staff only.
alter table public.image_guides add column if not exists file_path text;
alter table public.image_guides add column if not exists file_name text;
