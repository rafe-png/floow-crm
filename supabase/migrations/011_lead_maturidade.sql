-- floow CRM — campos de maturidade/momento da empresa na qualificação.
-- Rodar uma única vez no SQL Editor do Supabase.
-- Usados pelo cálculo de qualidade do lead (1–5 estrelas) na agenda.

-- ============================================================
-- Enums
-- ============================================================
create type experiencia as enum ('menos_6m', '6m_1ano', '1_5anos', 'mais_5anos');
create type situacao as enum ('sem_clientes', 'com_sem_demanda', 'com_com_demanda');
create type canal_vendas as enum ('box', 'loja', 'online');

-- ============================================================
-- Novas colunas em leads
-- ============================================================
alter table leads add column experiencia experiencia;
alter table leads add column situacao situacao;
alter table leads add column canal_vendas canal_vendas;
