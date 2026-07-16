-- floow CRM — 038: gasto da Meta POR CRIATIVO (nível anúncio).
-- Rodar no SQL Editor. Idempotente.
--
-- Até aqui só tínhamos o gasto TOTAL por dia (meta_ad_spend_daily, nível conta),
-- então não dava pra calcular CPL/CAC por criativo. Esta tabela guarda o gasto
-- diário por código de criativo, lido do NOME DO ANÚNCIO na Meta.
--
-- ⚠️ CONVENÇÃO DE NOME: o código sai do último número do nome do anúncio
--    "add_video_08" → 8 · "add_video_AD_30" → 30 · "contratação" → sem código (ignorado)
-- Se um anúncio for renomeado sem número, ele deixa de ser atribuído a um criativo.

create table if not exists meta_creative_spend_daily (
  day date not null,
  criativo_codigo int not null,
  spend numeric not null default 0,
  leads int not null default 0,        -- conversas iniciadas atribuídas ao anúncio
  impressions int not null default 0,
  clicks int not null default 0,
  updated_at timestamptz not null default now(),
  primary key (day, criativo_codigo)
);

create index if not exists meta_creative_spend_codigo_idx on meta_creative_spend_daily (criativo_codigo);

-- Realtime (a UI atualiza sozinha quando a sync grava).
alter table meta_creative_spend_daily replica identity full;
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'meta_creative_spend_daily'
  ) then
    alter publication supabase_realtime add table meta_creative_spend_daily;
  end if;
end $$;

-- RLS: leitura pra autenticado; escrita só service_role (a rota /api/meta/sync).
alter table meta_creative_spend_daily enable row level security;
drop policy if exists "auth read meta creative spend" on meta_creative_spend_daily;
create policy "auth read meta creative spend" on meta_creative_spend_daily
  for select using (auth.role() = 'authenticated');
