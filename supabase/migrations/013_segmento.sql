-- Fase: funil — segmento da confecção no lead.
-- Aplicar no Supabase (SQL Editor).
alter table leads add column if not exists segmento text;
