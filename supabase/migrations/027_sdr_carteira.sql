-- floow CRM — 027: libera o SDR a mover leads pra "Carteira"
-- Rodar no SQL Editor. (carteira já existe no enum; é só ajustar o RLS.)

drop policy if exists "rls update leads" on leads;
create policy "rls update leads" on leads for update
  using (auth.role() = 'authenticated')
  with check (
    app_is_admin()
    or app_is_closer()
    or status in ('qualificado', 'em_agendamento', 'reuniao_agendada', 'carteira', 'desqualificado', 'sem_resposta')
  );
