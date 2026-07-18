-- floow CRM — 039: só o ADMIN pode excluir leads.
-- Antes (016) era "admin OU dono do lead" — então um SDR conseguia apagar os
-- próprios leads. Agora só o admin (Rafe) exclui. Rodar no SQL Editor.
--
-- Segurança de verdade é aqui (no banco): mesmo que a UI mostre um botão, o
-- Postgres recusa o DELETE de quem não é admin.

drop policy if exists "rls delete leads" on leads;
create policy "rls delete leads" on leads for delete
  using (app_is_admin());
