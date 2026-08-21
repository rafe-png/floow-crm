-- floow CRM — 046: Playbooks comerciais (tipo Notion interno).
-- Rodar no SQL Editor. Idempotente.
--
-- Documentos de processo/vendas em Markdown. LEITURA: todo mundo autenticado.
-- ESCRITA: só o admin (app_is_admin()). Gerenciados na página /playbooks.

create table if not exists playbooks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  emoji text,
  categoria text,                 -- agrupamento no menu lateral
  conteudo text not null default '',  -- corpo em Markdown
  ordem int not null default 0,
  updated_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists playbooks_categoria_ordem_idx on playbooks (categoria, ordem);

-- Mantém updated_at.
create or replace function set_playbooks_updated_at() returns trigger as $$
begin new.updated_at := now(); return new; end;
$$ language plpgsql;
drop trigger if exists trg_playbooks_updated_at on playbooks;
create trigger trg_playbooks_updated_at before update on playbooks
  for each row execute function set_playbooks_updated_at();

alter table playbooks enable row level security;
drop policy if exists "auth read playbooks" on playbooks;
create policy "auth read playbooks" on playbooks for select using (auth.role() = 'authenticated');
drop policy if exists "admin write playbooks" on playbooks;
create policy "admin write playbooks" on playbooks for all
  using (app_is_admin()) with check (app_is_admin());

-- Realtime (a lista/edição atualiza sozinha).
alter table playbooks replica identity full;
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'playbooks'
  ) then
    alter publication supabase_realtime add table playbooks;
  end if;
end $$;
