-- floow CRM — Fase 2.4-prep: time
-- Rodar no SQL Editor do Supabase.

create table team_members (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  role text not null check (role in ('SDR', 'Closer')),
  email text unique,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create index team_members_role_idx on team_members (role, active);

-- Seeds iniciais
insert into team_members (name, role) values
  ('Mariana', 'SDR'),
  ('Rafe',    'Closer');

-- Realtime
alter publication supabase_realtime add table team_members;

-- RLS (MVP sem auth — políticas permissivas)
alter table team_members enable row level security;

create policy "mvp read team"   on team_members for select using (true);
create policy "mvp insert team" on team_members for insert with check (true);
create policy "mvp update team" on team_members for update using (true) with check (true);
create policy "mvp delete team" on team_members for delete using (true);
