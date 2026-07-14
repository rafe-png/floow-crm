-- floow CRM — 036: sincroniza a RLS de UPDATE de leads com as etapas do SDR.
-- Rodar no SQL Editor (não mexe em enum, pode rodar junto).
--
-- A lista antiga (027) tinha ficado pra trás:
--   • 'agendando'      (Em agendamento, migração 028) — nunca foi liberada
--   • 'pre_qualificado' (Pré qualificado, migração 034) — nunca foi liberada
--   • 'no_show'        — agora liberada por pedido (SDR remarca no-show)
-- Sem isso, o SDR (ex.: Mariana) era BLOQUEADO pelo banco ao mover pra essas
-- etapas, mesmo o front deixando arrastar. O admin/Closer nunca sentiu.
--
-- Esta lista precisa espelhar SDR_STAGES em lib/types.ts.

drop policy if exists "rls update leads" on leads;
create policy "rls update leads" on leads for update
  using (auth.role() = 'authenticated')
  with check (
    app_is_admin()
    or app_is_closer()
    or status in (
      'qualificado',
      'pre_qualificado',
      'em_agendamento',
      'agendando',
      'carteira',
      'reuniao_agendada',
      'no_show',
      'desqualificado',
      'sem_resposta'
    )
  );
