-- Fase: usuários — vincula cada membro do time ao email de login.
-- O CRM identifica o usuário logado (e o "dono" padrão de um lead) cruzando
-- team_members.email com o email da sessão Supabase Auth.
--
-- IMPORTANTE: esses emails precisam ser EXATAMENTE os mesmos das contas de
-- login (Supabase Auth → Users). Ajuste se os seus forem diferentes.

-- Mariana (SDR)
update team_members
  set email = 'mariana@floowdigital.com'
  where lower(name) = 'mariana' and email is null;

-- Rafe (admin) — vincula a linha de Closer (papel principal dele).
-- email é UNIQUE, então só uma linha do Rafe pode carregar o email.
update team_members
  set email = 'rafe@floowdigital.com'
  where lower(name) = 'rafe' and role = 'Closer' and email is null;
