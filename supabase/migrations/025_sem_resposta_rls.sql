-- floow CRM — 025: libera o SDR a mover leads pra "Sem resposta"
-- Rodar DEPOIS da 024. (O auto-move do cron usa service_role e ignora o RLS;
--  isto é pro SDR mover/recuperar na mão.)

drop policy if exists "rls update leads" on leads;
create policy "rls update leads" on leads for update
  using (auth.role() = 'authenticated')
  with check (
    app_is_admin()
    or app_is_closer()
    or status in ('qualificado', 'em_agendamento', 'reuniao_agendada', 'desqualificado', 'sem_resposta')
  );
