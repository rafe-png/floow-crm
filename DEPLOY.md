# Publicar o floow CRM em crm.floowdigital.com.br

Guia passo a passo. Tudo que precisa de senha/login é feito por você (Rafe) —
o Claude te orienta em cada clique. Ordem importa: siga de cima pra baixo.

---

## Etapa 1 — Banco de dados (Supabase) ✅ antes de tudo

O CRM já aponta pro seu Supabase (está no `.env.local`). Falta garantir que
**todas as 10 migrações** foram aplicadas.

1. Abra o painel do Supabase → **SQL Editor**.
2. Para cada arquivo em `supabase/migrations/` (001 até 010), na ordem,
   cole o conteúdo e clique **Run**. Se já tiver rodado algum, pode pular —
   eles avisam se já existe (a 010 é segura de rodar de novo).
3. A migração **010** adiciona o "Rafe" como SDR. (Ou você pode adicionar
   pela tela Configurações → Equipe depois que o app estiver no ar.)

## Etapa 2 — Logins do time (Supabase Auth)

O app só tem tela de *entrar* — os acessos são criados no Supabase:

1. Painel do Supabase → **Authentication** → **Users** → **Add user**.
2. Crie um para você e um para a Mariana (email + senha).
3. Esses serão os logins de acesso ao CRM.

## Etapa 3 — Código no GitHub

1. Crie uma conta em github.com (se não tiver) e um repositório **privado**
   chamado `floow-crm` (deixe vazio, sem README).
2. Avise o Claude — ele conecta este projeto ao repositório e envia o código.

## Etapa 4 — Publicar na Vercel

1. Entre em vercel.com com a conta do GitHub.
2. **Add New → Project** → importe o `floow-crm`.
3. Em **Environment Variables**, copie as 6 chaves do seu `.env.local`:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `GOOGLE_CLIENT_ID`
   - `GOOGLE_CLIENT_SECRET`
   - `GOOGLE_REDIRECT_URI` → **mude** para:
     `https://crm.floowdigital.com.br/api/auth/google/callback`
4. Clique **Deploy**. Em ~1 min o app está no ar num endereço `.vercel.app`.

## Etapa 5 — Domínio crm.floowdigital.com.br

1. Na Vercel: projeto → **Settings → Domains** → adicione
   `crm.floowdigital.com.br`.
2. A Vercel mostra um registro **CNAME** pra criar.
3. No painel onde o `floowdigital.com.br` está registrado (Registro.br,
   GoDaddy, Cloudflare…), crie esse CNAME apontando `crm` para o valor da Vercel.
4. Espera alguns minutos e a Vercel valida sozinha (cadeado HTTPS automático).

## Etapa 6 — Google Calendar no domínio novo ⚠️ não esqueça

Senão o "Conectar Google Agenda" dá erro.

1. Google Cloud Console → **APIs & Services → Credentials** → seu OAuth Client.
2. Em **Authorized redirect URIs**, adicione:
   `https://crm.floowdigital.com.br/api/auth/google/callback`
3. Em **Authorized JavaScript origins**, adicione:
   `https://crm.floowdigital.com.br`
4. Salve. (Pode manter os de localhost pra continuar testando no seu Mac.)

---

## Pronto ✅
Acesse `https://crm.floowdigital.com.br`, faça login, e em Configurações
conecte a Google Agenda. A partir daí é só usar.

> Manutenção: cada vez que o código mudar e for enviado ao GitHub, a Vercel
> republica sozinha. Não precisa repetir as etapas.
