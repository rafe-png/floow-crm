-- floow CRM — 041: áudios por DONO + upload self-service pelo CRM.
-- Rodar no SQL Editor. Idempotente.
--
-- `owner` (null = "Todos", aparece pra todo mundo). Se preenchido com o NOME do
-- membro (ex: 'Rafe', 'Mariana'), o áudio só aparece/envia pra aquela pessoa na
-- extensão. O filtro é por `team_members.name` (mesmo nome usado pra achar a
-- instância do Z-API na rota /api/ext/send-audio).

alter table audio_snippets add column if not exists owner text; -- null = todos

-- Upload/gerência dos arquivos pela tela do CRM (admin logado = authenticated).
-- Leitura pública já foi criada na 040 (o Z-API baixa o áudio por URL).
drop policy if exists "auth write audios bucket" on storage.objects;
create policy "auth write audios bucket" on storage.objects
  for insert to authenticated with check (bucket_id = 'audios');

drop policy if exists "auth update audios bucket" on storage.objects;
create policy "auth update audios bucket" on storage.objects
  for update to authenticated using (bucket_id = 'audios');

drop policy if exists "auth delete audios bucket" on storage.objects;
create policy "auth delete audios bucket" on storage.objects
  for delete to authenticated using (bucket_id = 'audios');
