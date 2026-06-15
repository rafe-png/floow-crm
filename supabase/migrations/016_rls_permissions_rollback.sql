-- floow CRM — ROLLBACK da 016. Volta o RLS pro estado "só autenticado" (007).
-- Rode isto no SQL Editor se a 016 travar alguém do time.

-- leads
drop policy if exists "rls update leads" on leads;
drop policy if exists "rls delete leads" on leads;
create policy "auth update leads" on leads for update using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "auth delete leads" on leads for delete using (auth.role() = 'authenticated');

-- team_members
drop policy if exists "admin insert team" on team_members;
drop policy if exists "admin update team" on team_members;
drop policy if exists "admin delete team" on team_members;
create policy "auth insert team" on team_members for insert with check (auth.role() = 'authenticated');
create policy "auth update team" on team_members for update using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "auth delete team" on team_members for delete using (auth.role() = 'authenticated');

-- user_goals
drop policy if exists "rls update goals" on user_goals;
create policy "auth update goals" on user_goals for update using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- helpers (opcional remover)
drop function if exists app_owns_goal(text);
drop function if exists app_owns_lead(text, text);
drop function if exists app_is_closer();
drop function if exists app_is_admin();

-- A coluna is_admin pode ficar (o client usa optional chaining e cai no
-- fallback por email). Só remova se quiser desfazer 100%:
-- alter table team_members drop column if exists is_admin;
