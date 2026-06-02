-- floow CRM — Fase 2.5: timestamps fotográficos pra contagem estável
-- Rodar no SQL Editor do Supabase.

-- ============================================================
-- Colunas
-- ============================================================
alter table leads add column agendado_em timestamptz;
alter table leads add column ganho_em timestamptz;

create index leads_agendado_em_idx on leads (agendado_em);
create index leads_ganho_em_idx on leads (ganho_em);

-- ============================================================
-- Trigger: setar agendado_em / ganho_em (one-shot, nunca sobrescreve)
-- ============================================================
create or replace function set_status_timestamps() returns trigger as $$
begin
  -- Primeira vez que o lead entra em reuniao_agendada → registra
  if NEW.status = 'reuniao_agendada' and NEW.agendado_em is null then
    NEW.agendado_em := now();
  end if;
  -- Primeira vez que o lead vira negocio_ganho → registra
  if NEW.status = 'negocio_ganho' and NEW.ganho_em is null then
    NEW.ganho_em := now();
  end if;
  return NEW;
end;
$$ language plpgsql;

create trigger leads_set_status_timestamps_insert
before insert on leads
for each row execute function set_status_timestamps();

create trigger leads_set_status_timestamps_update
before update on leads
for each row execute function set_status_timestamps();

-- ============================================================
-- Backfill dos leads existentes (puxa do lead_events)
-- ============================================================
update leads set agendado_em = sub.first_event
from (
  select lead_id, min(created_at) as first_event
  from lead_events
  where to_status = 'reuniao_agendada'
  group by lead_id
) sub
where leads.id = sub.lead_id and leads.agendado_em is null;

update leads set ganho_em = sub.first_event
from (
  select lead_id, min(created_at) as first_event
  from lead_events
  where to_status = 'negocio_ganho'
  group by lead_id
) sub
where leads.id = sub.lead_id and leads.ganho_em is null;
