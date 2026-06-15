-- floow CRM — 026: realtime confiável entre usuários
-- Rodar no SQL Editor. Idempotente.
--
-- PROBLEMA: com RLS ligado, o Supabase Realtime precisa do registro COMPLETO
-- (antigo) pra entregar eventos de UPDATE/DELETE aos outros usuários. Sem
-- REPLICA IDENTITY FULL, o "lead movido" por um usuário pode não chegar no
-- outro (parece delay / não atualiza sem recarregar).

alter table leads          replica identity full;
alter table lead_events    replica identity full;
alter table tasks          replica identity full;
alter table team_members   replica identity full;
alter table user_goals     replica identity full;

-- Garante que todas estão na publicação de realtime (idempotente).
do $$
declare t text;
begin
  foreach t in array array['leads','lead_events','tasks','team_members','user_goals'] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table %I', t);
    end if;
  end loop;
end $$;
