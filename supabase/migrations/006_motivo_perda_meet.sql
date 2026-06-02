-- floow CRM — Fase 2.5: motivo da perda + link do Google Meet
-- Rodar no SQL Editor do Supabase.

create type motivo_perda as enum (
  'sem_budget',
  'sem_timing',
  'sem_fit',
  'concorrente',
  'nao_decisor',
  'sem_retorno',
  'preco_alto',
  'outro'
);

alter table leads add column motivo_perda motivo_perda;
alter table leads add column meet_link text;
