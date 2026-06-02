-- floow CRM — Fase 2.4: auth + integração Google Calendar
-- Rodar no SQL Editor do Supabase.

-- ============================================================
-- Tabela singleton de credenciais Google Calendar
-- (1 só agenda compartilhada — só pode ler/escrever via service_role)
-- ============================================================
create table google_credentials (
  id text primary key default 'singleton',
  access_token text not null,
  refresh_token text not null,
  expires_at timestamptz not null,
  email text,
  calendar_id text default 'primary',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (id = 'singleton')
);

alter table google_credentials enable row level security;
-- Sem policy = ninguém autenticado consegue ler. Só service_role bypassa.

-- ============================================================
-- Atualizar RLS das tabelas existentes pra exigir autenticação
-- (Antes era using(true) = aberto pra anon)
-- ============================================================

-- leads
drop policy if exists "mvp read leads"   on leads;
drop policy if exists "mvp insert leads" on leads;
drop policy if exists "mvp update leads" on leads;
drop policy if exists "mvp delete leads" on leads;

create policy "auth read leads"   on leads for select using (auth.role() = 'authenticated');
create policy "auth insert leads" on leads for insert with check (auth.role() = 'authenticated');
create policy "auth update leads" on leads for update using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "auth delete leads" on leads for delete using (auth.role() = 'authenticated');

-- lead_events
drop policy if exists "mvp read events"   on lead_events;
drop policy if exists "mvp insert events" on lead_events;

create policy "auth read events"   on lead_events for select using (auth.role() = 'authenticated');
create policy "auth insert events" on lead_events for insert with check (auth.role() = 'authenticated');

-- user_goals
drop policy if exists "mvp read goals"   on user_goals;
drop policy if exists "mvp update goals" on user_goals;

create policy "auth read goals"   on user_goals for select using (auth.role() = 'authenticated');
create policy "auth update goals" on user_goals for update using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- team_members
drop policy if exists "mvp read team"   on team_members;
drop policy if exists "mvp insert team" on team_members;
drop policy if exists "mvp update team" on team_members;
drop policy if exists "mvp delete team" on team_members;

create policy "auth read team"   on team_members for select using (auth.role() = 'authenticated');
create policy "auth insert team" on team_members for insert with check (auth.role() = 'authenticated');
create policy "auth update team" on team_members for update using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "auth delete team" on team_members for delete using (auth.role() = 'authenticated');
