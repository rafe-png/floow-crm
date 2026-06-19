-- floow CRM — 029: rastreio de no-shows seguidos.
-- Rodar DEPOIS da 028 (precisa do enum já com 'agendando' aplicado). Idempotente.
--
-- Regras (mantidas por trigger, fonte de verdade no banco):
--  - Ao ENTRAR em 'no_show': guarda a data/hora do horário furado (a data_agendamento
--    que estava marcada) em last_no_show_em e incrementa no_show_count.
--  - Quando a reunião realmente acontece (sai de 'reuniao_agendada' p/ ganho/perdido/
--    follow_up/carteira): zera no_show_count (a sequência de furos foi quebrada).
--  - 2+ no-shows seguidos viram aviso no card do lead.

alter table leads add column if not exists no_show_count   int not null default 0;
alter table leads add column if not exists last_no_show_em  timestamptz;

-- ============================================================
-- Estende set_status_timestamps (017) com a lógica de no-show.
-- Mantém tudo que já existia (agendado_em / ganho_em / reuniao_realizada_em).
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

  -- No-show: registra o horário furado e conta no-shows seguidos.
  -- (O client zera NEW.data_agendamento na mesma update; OLD ainda tem o horário.)
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
-- Backfill a partir do histórico (lead_events).
--  - last_no_show_em = data do último evento de no-show.
--  - no_show_count   = no-shows que aconteceram DEPOIS da última reunião concluída.
-- ============================================================
update leads l set
  last_no_show_em = ns.last_ns,
  no_show_count = ns.cnt
from (
  select e.lead_id,
         max(e.created_at) as last_ns,
         count(*) filter (
           where e.created_at > coalesce((
             select max(m.created_at)
             from lead_events m
             where m.lead_id = e.lead_id
               and m.tipo = 'status_change'
               and m.from_status = 'reuniao_agendada'
               and m.to_status in ('negocio_ganho', 'negocio_perdido', 'follow_up', 'carteira')
           ), 'epoch'::timestamptz)
         ) as cnt
  from lead_events e
  where e.tipo = 'status_change' and e.to_status = 'no_show'
  group by e.lead_id
) ns
where l.id = ns.lead_id;
