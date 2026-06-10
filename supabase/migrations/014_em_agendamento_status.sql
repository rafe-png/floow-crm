-- Fase: funil — adiciona a etapa "Em agendamento" entre "Qualificado" e "Reunião agendada".
-- Aplicar no Supabase (SQL Editor) ANTES de usar a nova etapa no CRM.
-- (ALTER TYPE ... ADD VALUE não pode rodar dentro de transação/bloco; rode solto.)
alter type lead_status add value if not exists 'em_agendamento' after 'qualificado';
