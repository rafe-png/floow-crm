-- floow CRM — 042: localização do lead (cidade + estado) pro mapa de calor.
-- Rodar no SQL Editor. Idempotente.
--
-- `cidade` = texto (escolhido num seletor de cidades-alvo, ou "Outra").
-- `estado` = UF de 2 letras (ex: 'PE', 'AL') — é o que alimenta o mapa por estado
-- nos Relatórios/Dashboard. Preenchidos na pré-qualificação.

alter table leads add column if not exists cidade text;
alter table leads add column if not exists estado text;
