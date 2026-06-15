-- floow CRM — 020: garante o tempo real (realtime) da tabela ad_investments
-- Rodar no SQL Editor. Idempotente. Opcional: o app já atualiza na hora pra quem
-- lança (atualização otimista); isto liga a sincronização AO VIVO entre usuários
-- (ex: o Eduardo lança e o Rafe vê na hora, sem recarregar).

do $$ begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'ad_investments'
  ) then
    alter publication supabase_realtime add table ad_investments;
  end if;
end $$;

-- replica identity full ajuda os eventos de UPDATE/DELETE a virem completos.
alter table ad_investments replica identity full;
