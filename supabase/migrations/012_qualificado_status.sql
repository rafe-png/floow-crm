-- Fase: funil — adiciona a etapa "Qualificado" antes de "reuniao_agendada".
-- Aplicar no Supabase (SQL Editor) ANTES de usar a nova coluna no CRM.
alter type lead_status add value if not exists 'qualificado' before 'reuniao_agendada';
