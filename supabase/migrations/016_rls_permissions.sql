-- floow CRM — Fase de segurança: RLS com papéis (admin / SDR / Closer)
-- Rodar no SQL Editor do Supabase. Idempotente (pode rodar mais de uma vez).
--
-- CONTEXTO
-- Até aqui o RLS só exigia "estar logado" (auth.role() = 'authenticated'),
-- ou seja: qualquer usuário autenticado podia ler/editar/apagar TUDO. As regras
-- reais (zona do Closer, gestão de usuários só pro admin) viviam só no client e
-- podiam ser burladas chamando o Supabase direto. Esta migração move essas
-- regras pro banco.
--
-- PRÉ-REQUISITOS (já devem estar aplicados — o app em produção já os usa):
--   012/014 — enum lead_status com 'qualificado' e 'em_agendamento'
--   015     — team_members.email preenchido (identidade = email da sessão)
-- Confira com:  select name, role, email from team_members order by name;
--
-- DECISÕES
--   • Leitura (SELECT) continua liberada pra quem está logado. Time de 2 pessoas
--     de confiança; dashboard, ranking e realtime precisam ler tudo. Quando o
--     time crescer, dá pra restringir leitura por responsável (passo futuro).
--   • Escrita é que passa a ter papel.

-- ============================================================
-- Admin vira DADO (coluna em team_members) em vez de email fixo no código.
-- Assim dá pra promover/remover admin sem deploy. O email continua como rede
-- de segurança em app_is_admin() pra ninguém se trancar pra fora.
-- ============================================================
alter table team_members add column if not exists is_admin boolean not null default false;

update team_members set is_admin = true
  where lower(email) = 'rafe@floowdigital.com' and is_admin = false;

-- ============================================================
-- Helpers de identidade (SECURITY DEFINER: leem team_members
-- ignorando o RLS da própria tabela, sem expor dados)
-- ============================================================

-- Admin do CRM: qualquer membro ativo com is_admin = true.
-- O OR final é a rede de segurança (espelha ADMIN_EMAIL em lib/types.ts).
create or replace function app_is_admin() returns boolean
  language sql stable security definer set search_path = public as $$
  select coalesce(
    (select bool_or(is_admin) from team_members
       where active and lower(email) = lower(auth.email())),
    false
  ) or lower(coalesce(auth.email(), '')) = 'rafe@floowdigital.com';
$$;

-- True se o login atual tem alguma linha ativa de Closer.
create or replace function app_is_closer() returns boolean
  language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from team_members
    where active
      and role = 'Closer'
      and lower(email) = lower(auth.email())
  );
$$;

-- True se o login atual é responsável (SDR ou Closer) pelo lead.
-- Os leads apontam pro responsável por NOME; aqui cruzamos os nomes das linhas
-- do time que carregam o email do login.
create or replace function app_owns_lead(p_sdr text, p_closer text) returns boolean
  language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from team_members m
    where m.active
      and lower(m.email) = lower(auth.email())
      and (m.name = p_sdr or m.name = p_closer)
  );
$$;

-- True se o login atual pode editar a meta de um papel (owner_type).
create or replace function app_owns_goal(p_owner text) returns boolean
  language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from team_members m
    where m.active
      and lower(m.email) = lower(auth.email())
      and m.role = p_owner
  );
$$;

-- ============================================================
-- leads
-- ============================================================
-- SELECT/INSERT: continuam por "autenticado".
drop policy if exists "auth read leads"   on leads;
drop policy if exists "auth insert leads" on leads;
create policy "auth read leads"   on leads for select using (auth.role() = 'authenticated');
create policy "auth insert leads" on leads for insert with check (auth.role() = 'authenticated');

-- UPDATE: zona do Closer travada pro SDR. O status RESULTANTE da edição só pode
-- ser uma etapa do SDR, a menos que o login seja admin ou Closer. Isso bloqueia
-- tanto mover pra no_show/follow_up/... quanto editar qualquer campo de um lead
-- que já esteja na zona do Closer.
drop policy if exists "auth update leads" on leads;
drop policy if exists "rls update leads"  on leads;
create policy "rls update leads" on leads for update
  using (auth.role() = 'authenticated')
  with check (
    app_is_admin()
    or app_is_closer()
    or status in ('qualificado', 'em_agendamento', 'reuniao_agendada')
  );

-- DELETE: só admin ou o dono do lead.
drop policy if exists "auth delete leads" on leads;
drop policy if exists "rls delete leads"  on leads;
create policy "rls delete leads" on leads for delete
  using (app_is_admin() or app_owns_lead(sdr_responsavel, closer_responsavel));

-- ============================================================
-- lead_events  (append-only, escrito por TRIGGER no contexto do usuário)
-- Mantido em "autenticado": o trigger de status precisa inserir aqui.
-- ============================================================
-- (sem mudança — policies de 007 permanecem)

-- ============================================================
-- team_members  (gestão de usuários só pelo admin)
-- As API routes create-user/delete-user usam service_role e ignoram o RLS,
-- então continuam funcionando normalmente.
-- ============================================================
drop policy if exists "auth read team"   on team_members;
drop policy if exists "auth insert team" on team_members;
drop policy if exists "auth update team" on team_members;
drop policy if exists "auth delete team" on team_members;
create policy "auth read team"    on team_members for select using (auth.role() = 'authenticated');
create policy "admin insert team" on team_members for insert with check (app_is_admin());
create policy "admin update team" on team_members for update using (app_is_admin()) with check (app_is_admin());
create policy "admin delete team" on team_members for delete using (app_is_admin());

-- ============================================================
-- user_goals  (cada um edita a meta do próprio papel; admin edita ambas)
-- ============================================================
drop policy if exists "auth read goals"   on user_goals;
drop policy if exists "auth update goals" on user_goals;
drop policy if exists "rls update goals"  on user_goals;
create policy "auth read goals"  on user_goals for select using (auth.role() = 'authenticated');
create policy "rls update goals" on user_goals for update
  using      (app_is_admin() or app_owns_goal(owner::text))
  with check (app_is_admin() or app_owns_goal(owner::text));

-- ============================================================
-- tasks  (mantido em "autenticado" por ora — colaborativo, baixo risco)
-- google_credentials  (já travado: sem policy, só service_role)
-- ============================================================
-- (sem mudança)
