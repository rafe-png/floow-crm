-- floow CRM — 037: carimbo de data do "negócio perdido" (perdido_em).
-- Faltava um timestamp pro perdido (ganho já tinha ganho_em). Sem ele, o relatório
-- não conseguia contar "perdidos no período" pela data do evento — só pelo status
-- atual, o que bagunçava os números por dia/semana. Idempotente.

alter table leads add column if not exists perdido_em timestamptz;
create index if not exists leads_perdido_em_idx on leads (perdido_em);

-- ============================================================
-- Estende set_status_timestamps (029) adicionando perdido_em (one-shot).
-- Mantém tudo que já existia (agendado/ganho/reuniao_realizada/no-show).
-- ============================================================
create or replace function set_status_timestamps() returns trigger as $$
begin
  if NEW.status = 'reuniao_agendada' and NEW.agendado_em is null then
    NEW.agendado_em := now();
  end if;
  if NEW.status = 'negocio_ganho' and NEW.ganho_em is null then
    NEW.ganho_em := now();
  end if;
  if NEW.status = 'negocio_perdido' and NEW.perdido_em is null then
    NEW.perdido_em := now();
  end if;
  if TG_OP = 'UPDATE'
     and OLD.status = 'reuniao_agendada'
     and NEW.status in ('negocio_ganho', 'negocio_perdido', 'follow_up')
     and NEW.reuniao_realizada_em is null then
    NEW.reuniao_realizada_em := now();
  end if;

  -- No-show: registra o horário furado e conta no-shows seguidos.
  if TG_OP = 'UPDATE'
     and NEW.status = 'no_show'
     and OLD.status is distinct from 'no_show' then
    NEW.no_show_count := coalesce(OLD.no_show_count, 0) + 1;
    NEW.last_no_show_em := coalesce(OLD.data_agendamento, now());
  end if;

  -- Reunião realmente aconteceu: zera a sequência de no-shows.
  if TG_OP = 'UPDATE'
     and OLD.status = 'reuniao_agendada'
     and NEW.status in ('negocio_ganho', 'negocio_perdido', 'follow_up', 'carteira') then
    NEW.no_show_count := 0;
  end if;

  return NEW;
end;
$$ language plpgsql;

-- ============================================================
-- Backfill perdido_em a partir do histórico (primeira vez que virou perdido).
-- Fallback: leads perdidos sem evento usam updated_at.
-- ============================================================
update leads set perdido_em = sub.first_event
from (
  select lead_id, min(created_at) as first_event
  from lead_events
  where tipo = 'status_change' and to_status = 'negocio_perdido'
  group by lead_id
) sub
where leads.id = sub.lead_id and leads.perdido_em is null;

update leads set perdido_em = updated_at
where status = 'negocio_perdido' and perdido_em is null;
