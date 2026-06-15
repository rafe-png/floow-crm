-- floow CRM — 023: motivo da desqualificação + permissão pro SDR desqualificar
-- Rodar DEPOIS da 022 (usa o valor 'desqualificado' do enum).

alter table leads add column if not exists motivo_desqualificacao text;

-- Desqualificar é trabalho do SDR (na qualificação), então liberamos no RLS:
-- o status resultante 'desqualificado' passa a ser permitido pra ele.
drop policy if exists "rls update leads" on leads;
create policy "rls update leads" on leads for update
  using (auth.role() = 'authenticated')
  with check (
    app_is_admin()
    or app_is_closer()
    or status in ('qualificado', 'em_agendamento', 'reuniao_agendada', 'desqualificado')
  );
