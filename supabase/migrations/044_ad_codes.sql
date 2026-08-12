-- floow CRM — 044: códigos de anúncio configuráveis (o que "puxa" o lead do WhatsApp).
-- Rodar no SQL Editor. Idempotente.
--
-- Antes: o webhook aceitava QUALQUER número entre colchetes ([01], [08]…).
-- Agora: só cria lead se o código da mensagem estiver CADASTRADO aqui (ativo).
-- Suporta alfanuméricos (ex: 'C1-25', '08V2'). Gerenciado em Configurações.

create table if not exists ad_codes (
  id uuid primary key default gen_random_uuid(),
  code text not null,          -- código SEM colchetes (ex: '01', 'C1-25', '08V2')
  label text,                  -- descrição opcional (ex: 'Vídeo depoimento — tarde')
  active boolean not null default true,
  created_at timestamptz not null default now()
);
-- Evita duplicar o mesmo código (case-insensitive).
create unique index if not exists ad_codes_code_uidx on ad_codes (upper(code));

alter table ad_codes enable row level security;
drop policy if exists "auth read ad_codes" on ad_codes;
create policy "auth read ad_codes" on ad_codes for select using (auth.role() = 'authenticated');
drop policy if exists "admin write ad_codes" on ad_codes;
create policy "admin write ad_codes" on ad_codes for all
  using (app_is_admin()) with check (app_is_admin());

-- Realtime (a lista atualiza sozinha na tela).
alter table ad_codes replica identity full;
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'ad_codes'
  ) then
    alter publication supabase_realtime add table ad_codes;
  end if;
end $$;

-- Guarda o código como TEXTO no lead (alfanumérico). `criativo_codigo` (int) segue
-- pros códigos numéricos + relatório de criativos.
alter table leads add column if not exists criativo_codigo_txt text;

-- Seed: cadastra os códigos numéricos que JÁ trouxeram leads (não quebra o que já roda).
insert into ad_codes (code)
select distinct criativo_codigo::text
from leads
where criativo_codigo is not null
on conflict do nothing;
