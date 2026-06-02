-- floow CRM — adiciona Rafe como opção de SDR (continua sendo Closer também)
-- Rodar no SQL Editor do Supabase.
-- Idempotente: não duplica se já existir.

insert into team_members (name, role)
select 'Rafe', 'SDR'
where not exists (
  select 1 from team_members where name = 'Rafe' and role = 'SDR'
);
