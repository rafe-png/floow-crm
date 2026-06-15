-- floow CRM — 017: data da reunião realizada + código do criativo
-- Rodar no SQL Editor do Supabase. Idempotente.
--
-- 1) reuniao_realizada_em: marcado quando o lead SAI de 'reuniao_agendada' para
--    'negocio_ganho' / 'negocio_perdido' / 'follow_up' (a reunião aconteceu).
--    No-show NÃO conta (reunião não rolou).
-- 2) criativo_codigo: qual anúncio trouxe o cliente. Preenchido ao ganhar o
--    negócio (popup no funil). Usado nos relatórios de criativos.

alter table leads add column if not exists reuniao_realizada_em timestamptz;
alter table leads add column if not exists criativo_codigo int;

create index if not exists leads_reuniao_realizada_em_idx on leads (reuniao_realizada_em);
create index if not exists leads_criativo_codigo_idx       on leads (criativo_codigo);

-- ============================================================
-- Estende o trigger set_status_timestamps (de 008) pra também marcar
-- reuniao_realizada_em (one-shot, nunca sobrescreve). Mantém o comportamento
-- original de agendado_em / ganho_em.
-- ============================================================
create or replace function set_status_timestamps() returns trigger as $$
begin
  if NEW.status = 'reuniao_agendada' and NEW.agendado_em is null then
    NEW.agendado_em := now();
  end if;
  if NEW.status = 'negocio_ganho' and NEW.ganho_em is null then
    NEW.ganho_em := now();
  end if;
  if TG_OP = 'UPDATE'
     and OLD.status = 'reuniao_agendada'
     and NEW.status in ('negocio_ganho', 'negocio_perdido', 'follow_up')
     and NEW.reuniao_realizada_em is null then
    NEW.reuniao_realizada_em := now();
  end if;
  return NEW;
end;
$$ language plpgsql;
-- (os triggers de INSERT/UPDATE de 008 já apontam pra esta função — nada a recriar)

-- ============================================================
-- Backfill: leads que já passaram pela reunião usam o histórico (lead_events).
-- ============================================================
update leads set reuniao_realizada_em = sub.first_event
from (
  select lead_id, min(created_at) as first_event
  from lead_events
  where tipo = 'status_change'
    and from_status = 'reuniao_agendada'
    and to_status in ('negocio_ganho', 'negocio_perdido', 'follow_up')
  group by lead_id
) sub
where leads.id = sub.lead_id and leads.reuniao_realizada_em is null;
