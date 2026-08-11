-- floow CRM — 043: quem realizou o agendamento.
-- Rodar no SQL Editor. Idempotente.
--
-- `agendado_por` = nome do usuário (team_members.name) que moveu o lead para
-- "Reunião agendada". Diferente de:
--   - sdr_responsavel  (origem do lead — fixo)
--   - closer_responsavel (quem vai conduzir a reunião)
-- É carimbado no momento do agendamento (CRM e extensão).

alter table leads add column if not exists agendado_por text;
