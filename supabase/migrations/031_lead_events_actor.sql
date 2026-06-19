-- floow CRM — 031: autoria dos eventos do lead (quem fez a alteração).
-- Cada mudança de etapa passa a gravar o usuário logado (e-mail + nome do time)
-- em lead_events. Funciona pro app E pra extensão do WhatsApp (ambos usam a
-- sessão do usuário). O webhook (service_role) grava actor nulo = "sistema".
-- Idempotente.

alter table lead_events add column if not exists actor_email text;
alter table lead_events add column if not exists actor_name  text;

-- Evento 'created' agora guarda quem criou.
create or replace function log_lead_created() returns trigger as $$
declare ae text;
begin
  ae := auth.email();
  insert into lead_events (lead_id, tipo, to_status, actor_email, actor_name)
  values (
    NEW.id, 'created', NEW.status, ae,
    (select name from team_members where lower(email) = lower(ae) limit 1)
  );
  return NEW;
end;
$$ language plpgsql;

-- Evento 'status_change' agora guarda quem moveu.
create or replace function log_lead_status_change() returns trigger as $$
declare ae text;
begin
  ae := auth.email();
  NEW.updated_at = now();
  if OLD.status is distinct from NEW.status then
    insert into lead_events (lead_id, tipo, from_status, to_status, actor_email, actor_name)
    values (
      NEW.id, 'status_change', OLD.status, NEW.status, ae,
      (select name from team_members where lower(email) = lower(ae) limit 1)
    );
  end if;
  return NEW;
end;
$$ language plpgsql;
