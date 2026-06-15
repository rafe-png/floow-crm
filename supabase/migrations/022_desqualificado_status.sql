-- floow CRM — 022: etapa "Desqualificado" no funil
-- Rodar SOZINHA no SQL Editor, ANTES da 023.
-- (ALTER TYPE ADD VALUE não pode ser usado na mesma transação em que é criado,
--  por isso fica numa migração separada — mesmo padrão das 012/014.)

alter type lead_status add value if not exists 'desqualificado' after 'negocio_perdido';
