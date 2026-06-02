-- floow CRM — Fase 2.4-prep: responsáveis no lead
-- Rodar no SQL Editor do Supabase.

-- Pessoa responsável pelo lado SDR e pelo lado Closer (texto livre por enquanto).
-- Quando login chegar, esses campos serão auto-preenchidos a partir do usuário logado.

alter table leads add column sdr_responsavel text;
alter table leads add column closer_responsavel text;
