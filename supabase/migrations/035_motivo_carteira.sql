-- floow CRM — 035: motivo de o lead ter ido pra Carteira.
-- Carteira = "estacionamento" de leads que não estão prontos agora (sem estoque,
-- contrato ativo, sem urgência…). Ao mover pra lá, o CRM pede o motivo e logo em
-- seguida abre a criação de uma tarefa de recontato pro negócio.
-- Idempotente — pode rodar junto com outras.

alter table leads add column if not exists motivo_carteira text;

create index if not exists leads_motivo_carteira_idx on leads (motivo_carteira);
