-- floow CRM — 028: etapa "Em agendamento" (agendando) no funil.
-- Fica ENTRE "Qualificado" (em_agendamento) e "Reunião agendada".
-- O lead já foi qualificado e está em processo de marcar a reunião (sem horário ainda).
--
-- IMPORTANTE: ALTER TYPE ... ADD VALUE não pode rodar dentro de transação/bloco.
-- Rode este arquivo SOZINHO no SQL Editor, ANTES da 029.
alter type lead_status add value if not exists 'agendando' after 'em_agendamento';
