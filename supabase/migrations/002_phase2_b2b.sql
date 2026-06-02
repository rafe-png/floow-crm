-- floow CRM — Fase 2.1: campos B2B + meta do Closer
-- Rodar uma única vez no SQL Editor do Supabase.

-- ============================================================
-- Enums para pré-seleções de qualificação
-- ============================================================
create type estoque_nivel as enum ('muito', 'medio', 'pouco');
create type historico_trafego as enum ('ja_fez', 'fazendo', 'nunca_fez');
create type estrutura_comercial as enum ('2_mais_vendedores', '1_vendedor', 'dono_vende');

-- BANT
create type bant_budget as enum ('tem_verba', 'tem_indefinida', 'nao_tem');
create type bant_authority as enum ('decisor', 'influenciador', 'precisa_aprovar');
create type bant_need as enum ('alta', 'media', 'explorando');
create type bant_timing as enum ('agora', '30_dias', '60_90_dias', 'sem_urgencia');

-- ============================================================
-- Novas colunas em leads
-- ============================================================
alter table leads add column cargo text;
alter table leads add column empresa text;
alter table leads add column instagram text;
alter table leads add column estoque estoque_nivel;
alter table leads add column historico historico_trafego;
alter table leads add column estrutura estrutura_comercial;
alter table leads add column bant_budget bant_budget;
alter table leads add column bant_authority bant_authority;
alter table leads add column bant_need bant_need;
alter table leads add column bant_timing bant_timing;
alter table leads add column data_agendamento timestamptz;
alter table leads add column google_event_id text;
alter table leads add column google_calendar_id text;

create index leads_data_agendamento_idx on leads (data_agendamento);
create index leads_dono_idx on leads (dono);

-- ============================================================
-- Meta do Closer (para Closer, o número representa NEGÓCIOS GANHOS)
-- ============================================================
insert into user_goals (owner, daily_goal, weekly_goal) values
  ('Closer', 1, 5)
on conflict (owner) do nothing;
