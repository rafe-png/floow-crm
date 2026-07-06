-- floow CRM — 033: gasto diário de anúncios puxado automaticamente da Meta
-- (Facebook/Instagram Ads via Marketing API). Uma linha por dia. A sincronização
-- (rota /api/meta/sync) faz UPSERT com service_role; o app só LÊ.
--
-- Por que granularidade diária: qualquer intervalo "de X a Y" nos relatórios/
-- financeiro vira uma soma exata das linhas do período (sem rateio aproximado
-- como no lançamento manual de `ad_investments`).

create table if not exists meta_ad_spend_daily (
  day          date primary key,
  spend        numeric   not null default 0,   -- gasto no dia (R$)
  leads        integer   not null default 0,   -- conversas/mensagens iniciadas pelo anúncio
  impressions  bigint    not null default 0,
  clicks       bigint    not null default 0,
  updated_at   timestamptz not null default now()
);

alter table meta_ad_spend_daily enable row level security;

-- Leitura: qualquer usuário autenticado. Escrita: só service_role (a rota de
-- sync), que ignora RLS — por isso não há policy de insert/update aqui.
drop policy if exists "meta_spend_read" on meta_ad_spend_daily;
create policy "meta_spend_read" on meta_ad_spend_daily
  for select using (auth.role() = 'authenticated');

-- Realtime: o financeiro/relatórios atualizam sozinhos após a sincronização.
do $$
begin
  alter publication supabase_realtime add table meta_ad_spend_daily;
exception
  when duplicate_object then null;
end $$;
alter table meta_ad_spend_daily replica identity full;
