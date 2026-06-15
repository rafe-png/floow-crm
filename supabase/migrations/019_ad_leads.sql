-- floow CRM — 019: quantidade de leads (mensagens) dos anúncios por período
-- Rodar no SQL Editor do Supabase. Idempotente.
--
-- O gestor de tráfego informa, junto com o investimento, quantos leads/mensagens
-- os anúncios trouxeram naquele período (entrada manual — sem integração Meta).
-- Vira a base do "custo por lead" real dos anúncios.

alter table ad_investments add column if not exists leads_ads int not null default 0;
