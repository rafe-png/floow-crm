-- 076 — RELÓGIO DE CICLO da cadência (20 dias / 3 toques por dia).
--
-- A cadência nova: cada lead tem 20 dias de vida útil desde que (re)entra na
-- Entrada e, ao bater os 20 dias, NÃO vai pro Reaquecimento — fica na Entrada e a
-- gente troca o SDR (via aviso no topo do Dashboard). O relógio de 20 dias precisa
-- reiniciar na troca de SDR / na re-entrada SEM perder a data de entrada original.
--
-- ciclo_entrada_em = quando o CICLO atual começou. created_at (entrada original)
-- continua intocado (fica no histórico). O app conta os 20 dias e cobra toque a
-- partir de ciclo_entrada_em; cai pra created_at enquanto esta migração não roda.
--
-- Zona de cadência (onde o relógio/cobrança valem) = Entrada (qualificado) +
-- Pré qualificado (pre_qualificado) + Qualificado (em_agendamento). Ver
-- CADENCE_STAGES em lib/types.ts.

-- 1) Coluna (idempotente). Começa nula pra dar pra backfillar com a entrada real.
alter table public.leads
  add column if not exists ciclo_entrada_em timestamptz;

-- 2) Backfill / KICKOFF da cadência. Os leads que JÁ estão na zona de cadência
-- (Entrada/Pré qualificado/Qualificado) começam o ciclo HOJE — assim ninguém vence
-- no dia 1 e os primeiros vencimentos caem só daqui a 20 dias. Os demais recebem
-- created_at (irrelevante — fora da cadência não vencem).
update public.leads
  set ciclo_entrada_em = case
    when status in ('qualificado', 'pre_qualificado', 'em_agendamento') then now()
    else created_at
  end
  where ciclo_entrada_em is null;

-- 3) Default pra leads NOVOS (o ciclo começa quando o lead entra) + not null.
alter table public.leads alter column ciclo_entrada_em set default now();
alter table public.leads alter column ciclo_entrada_em set not null;
