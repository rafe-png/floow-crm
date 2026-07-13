-- floow CRM — 034: etapa "Pré qualificado" no funil.
-- Fica ENTRE "Entrada" (qualificado) e "Qualificado" (em_agendamento).
-- Nela ficam as informações do negócio (empresa, instagram, decisor, segmento);
-- a qualificação BANT continua obrigatória só de "Qualificado" em diante.
--
-- IMPORTANTE: ALTER TYPE ... ADD VALUE não roda dentro de transação/bloco.
-- Rode este arquivo SOZINHO no SQL Editor.
alter type lead_status add value if not exists 'pre_qualificado' after 'qualificado';
