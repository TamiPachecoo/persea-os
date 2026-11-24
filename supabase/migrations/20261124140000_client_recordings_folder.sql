-- The client's Google Drive folder with her recordings/transcripts. Staff
-- link it once on her page; the student opens it from Encontros, and
-- "Buscar gravações da pasta" brings the files inside into the app
-- (google-drive-meet-files action 'folder').
alter table public.clients add column if not exists recordings_folder_url text;
