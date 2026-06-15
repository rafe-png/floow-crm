-- floow CRM — 026: realtime confiável entre usuários
-- Rodar no SQL Editor. Idempotente.
--
-- PROBLEMA: com RLS ligado, o Supabase Realtime precisa do registro COMPLETO
-- pra entregar eventos de UPDATE/DELETE aos outros usuários. Sem REPLICA
-- IDENTITY FULL, o "lead movido" por um usuário pode não chegar no outro
-- (parece delay / não atualiza sem recarregar).
--
-- (As tabelas já estão na publicação supabase_realtime; aqui só ajustamos a
--  replica identity, que é o que faltava.)

alter table leads        replica identity full;
alter table lead_events  replica identity full;
alter table tasks        replica identity full;
alter table team_members replica identity full;
alter table user_goals   replica identity full;
