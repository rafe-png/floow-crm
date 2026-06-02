-- floow CRM — schema inicial (Fase 1)
-- Rodar este script uma única vez no SQL Editor do Supabase.

-- ============================================================
-- Tipos
-- ============================================================
create type lead_status as enum (
  'reuniao_agendada',
  'no_show',
  'follow_up',
  'carteira',
  'negocio_ganho',
  'negocio_perdido'
);

create type owner_type as enum ('SDR', 'Closer');

-- ============================================================
-- Tabela: leads
-- ============================================================
create table leads (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  nome text not null,
  telefone text not null,
  dono owner_type not null default 'SDR',
  valor numeric(12, 2),
  status lead_status not null default 'reuniao_agendada',
  observacoes text
);

create index leads_status_idx on leads (status);
create index leads_created_at_idx on leads (created_at desc);

-- ============================================================
-- Tabela: lead_events (histórico append-only)
-- ============================================================
create table lead_events (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references leads(id) on delete cascade,
  created_at timestamptz not null default now(),
  tipo text not null,                 -- 'created' | 'status_change' | 'note'
  from_status lead_status,
  to_status lead_status,
  payload jsonb
);

create index lead_events_lead_id_idx on lead_events (lead_id, created_at desc);

-- ============================================================
-- Tabela: user_goals (metas configuráveis por dono)
-- ============================================================
create table user_goals (
  id uuid primary key default gen_random_uuid(),
  owner owner_type not null unique,
  daily_goal int not null,
  weekly_goal int not null,
  updated_at timestamptz not null default now()
);

insert into user_goals (owner, daily_goal, weekly_goal) values
  ('SDR', 3, 15);

-- ============================================================
-- Triggers
-- ============================================================

-- Ao criar um lead, registra evento 'created'
create or replace function log_lead_created() returns trigger as $$
begin
  insert into lead_events (lead_id, tipo, to_status)
  values (NEW.id, 'created', NEW.status);
  return NEW;
end;
$$ language plpgsql;

create trigger lead_created_event
after insert on leads
for each row execute function log_lead_created();

-- Ao atualizar status, registra evento e atualiza updated_at
create or replace function log_lead_status_change() returns trigger as $$
begin
  NEW.updated_at = now();
  if OLD.status is distinct from NEW.status then
    insert into lead_events (lead_id, tipo, from_status, to_status)
    values (NEW.id, 'status_change', OLD.status, NEW.status);
  end if;
  return NEW;
end;
$$ language plpgsql;

create trigger lead_status_change_event
before update on leads
for each row execute function log_lead_status_change();

-- ============================================================
-- Realtime (sincroniza UI entre os 2 usuários)
-- ============================================================
alter publication supabase_realtime add table leads;
alter publication supabase_realtime add table lead_events;

-- ============================================================
-- Row Level Security
-- MVP sem auth: políticas permissivas para a publishable key.
-- Quando adicionar login (Fase futura), trocar `using (true)` por
-- `using (auth.role() = 'authenticated')`.
-- ============================================================
alter table leads enable row level security;
alter table lead_events enable row level security;
alter table user_goals enable row level security;

create policy "mvp read leads"    on leads        for select using (true);
create policy "mvp insert leads"  on leads        for insert with check (true);
create policy "mvp update leads"  on leads        for update using (true) with check (true);
create policy "mvp delete leads"  on leads        for delete using (true);

create policy "mvp read events"   on lead_events  for select using (true);
create policy "mvp insert events" on lead_events  for insert with check (true);

create policy "mvp read goals"    on user_goals   for select using (true);
create policy "mvp update goals"  on user_goals   for update using (true) with check (true);
