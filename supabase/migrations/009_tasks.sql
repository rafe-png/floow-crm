-- floow CRM — Fase 2.6: tarefas rápidas
-- Rodar no SQL Editor do Supabase.

create table tasks (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references leads(id) on delete cascade,
  titulo text not null,
  descricao text,
  due_at timestamptz,
  done boolean not null default false,
  done_at timestamptz,
  assignee text,            -- nome do membro responsável
  notify boolean not null default true,
  created_by text,          -- email do criador (auth user)
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index tasks_lead_id_idx        on tasks (lead_id);
create index tasks_due_at_pending_idx on tasks (due_at) where done = false;
create index tasks_assignee_done_idx  on tasks (assignee, done);

-- Trigger pra atualizar done_at + updated_at
create or replace function tasks_update_timestamps() returns trigger as $$
begin
  NEW.updated_at := now();
  if NEW.done = true and OLD.done = false then
    NEW.done_at := now();
  end if;
  if NEW.done = false and OLD.done = true then
    NEW.done_at := null;
  end if;
  return NEW;
end;
$$ language plpgsql;

create trigger tasks_set_timestamps
before update on tasks
for each row execute function tasks_update_timestamps();

-- Realtime
alter publication supabase_realtime add table tasks;

-- RLS
alter table tasks enable row level security;
create policy "auth read tasks"   on tasks for select using (auth.role() = 'authenticated');
create policy "auth insert tasks" on tasks for insert with check (auth.role() = 'authenticated');
create policy "auth update tasks" on tasks for update using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "auth delete tasks" on tasks for delete using (auth.role() = 'authenticated');
