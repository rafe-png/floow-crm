-- floow CRM — 018: papel "Gestor de tráfego" + Financeiro (investimento em ads)
-- Rodar no SQL Editor DEPOIS da 016 (usa o helper app_is_admin e a coluna is_admin).
-- Idempotente.

-- ============================================================
-- 1) Libera o 3º papel no time
-- ============================================================
alter table team_members drop constraint if exists team_members_role_check;
alter table team_members add constraint team_members_role_check
  check (role in ('SDR', 'Closer', 'Trafego'));

-- Helper: login atual é gestor de tráfego?
create or replace function app_is_traffic() returns boolean
  language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from team_members
    where active and role = 'Trafego' and lower(email) = lower(auth.email())
  );
$$;

-- ============================================================
-- 2) Eduardo (gestor de tráfego) — vincula ao login eduardo@floowdigital.com
-- (a conta de login é criada à parte, no Supabase Auth)
-- ============================================================
insert into team_members (name, role, email, active, is_admin)
select 'Eduardo', 'Trafego', 'eduardo@floowdigital.com', true, false
where not exists (
  select 1 from team_members where lower(email) = 'eduardo@floowdigital.com'
);

-- ============================================================
-- 3) Tabela de investimento em ads (por período, em dias)
-- ============================================================
create table if not exists ad_investments (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  periodo_inicio date not null,
  periodo_fim date not null,
  valor numeric(12, 2) not null,
  canal text,                      -- ex: 'Meta Ads', 'Google' (opcional)
  created_by text,                 -- email de quem lançou
  check (periodo_fim >= periodo_inicio)
);

create index if not exists ad_investments_periodo_idx on ad_investments (periodo_inicio, periodo_fim);

-- Trava de sobreposição no banco: dois períodos não podem se cruzar (inclusivo).
-- Mesmo que a UI falhe, o banco rejeita.
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'ad_investments_no_overlap') then
    alter table ad_investments add constraint ad_investments_no_overlap
      exclude using gist (daterange(periodo_inicio, periodo_fim, '[]') with &&);
  end if;
end $$;

-- Realtime
do $$ begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'ad_investments'
  ) then
    alter publication supabase_realtime add table ad_investments;
  end if;
end $$;

-- ============================================================
-- 4) RLS: todos autenticados LEEM (dashboard/relatórios precisam do CAC);
--    só admin ou gestor de tráfego ESCREVEM.
-- ============================================================
alter table ad_investments enable row level security;

drop policy if exists "auth read ad_investments"   on ad_investments;
drop policy if exists "fin insert ad_investments"   on ad_investments;
drop policy if exists "fin update ad_investments"   on ad_investments;
drop policy if exists "fin delete ad_investments"   on ad_investments;

create policy "auth read ad_investments" on ad_investments for select
  using (auth.role() = 'authenticated');
create policy "fin insert ad_investments" on ad_investments for insert
  with check (app_is_admin() or app_is_traffic());
create policy "fin update ad_investments" on ad_investments for update
  using (app_is_admin() or app_is_traffic()) with check (app_is_admin() or app_is_traffic());
create policy "fin delete ad_investments" on ad_investments for delete
  using (app_is_admin() or app_is_traffic());
