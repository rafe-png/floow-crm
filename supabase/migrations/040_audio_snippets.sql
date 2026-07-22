-- floow CRM — 040: biblioteca de áudios "prontos" pra enviar pela extensão.
-- Rodar no SQL Editor. Idempotente.
--
-- Cada snippet tem VÁRIAS variantes do mesmo áudio (urls[]). A extensão manda uma
-- variante ALEATÓRIA a cada envio — assim não é o mesmo arquivo toda vez (mitiga
-- o risco de o WhatsApp marcar como spam). Enviado via Z-API `send-audio`, chega
-- como áudio novo (voice note), sem etiqueta de "encaminhado".

create table if not exists audio_snippets (
  id uuid primary key default gen_random_uuid(),
  name text not null,               -- rótulo do botão na extensão
  urls text[] not null default '{}',-- variantes do áudio (rotação anti-spam)
  emoji text,                       -- ícone opcional pro botão
  active boolean not null default true,
  ordem int not null default 0,     -- ordem de exibição
  created_at timestamptz not null default now()
);

alter table audio_snippets enable row level security;
drop policy if exists "auth read audios" on audio_snippets;
create policy "auth read audios" on audio_snippets
  for select using (auth.role() = 'authenticated');
-- escrita: só via service_role (rotas server) — nada de INSERT/UPDATE pelo client.

-- Realtime (a extensão atualiza a lista sozinha se você adicionar um áudio).
alter table audio_snippets replica identity full;
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'audio_snippets'
  ) then
    alter publication supabase_realtime add table audio_snippets;
  end if;
end $$;

-- ============================================================
-- Bucket de storage pros arquivos de áudio (público pra o Z-API baixar por URL).
-- ============================================================
insert into storage.buckets (id, name, public)
values ('audios', 'audios', true)
on conflict (id) do nothing;

-- Leitura pública dos áudios (o Z-API precisa baixar por URL).
drop policy if exists "public read audios bucket" on storage.objects;
create policy "public read audios bucket" on storage.objects
  for select using (bucket_id = 'audios');
