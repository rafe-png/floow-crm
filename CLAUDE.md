# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project: floow CRM

Internal CRM for Floow Digital (B2B sales for confecções atacadistas). Team of 2: 1 SDR + 1 Closer.

## Stack

- Next.js 16 (App Router, Turbopack) + React 19 + TypeScript
- Supabase (Postgres + Realtime) for persistence
- Tailwind CSS v4 (dark theme, brand yellow `#f5c518`)
- `@dnd-kit` for kanban drag-and-drop
- `lucide-react` for icons (note: v1.x — `Instagram` icon doesn't exist, use `AtSign`)
- `date-fns` (ptBR locale) for date formatting

Env: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` in `.env.local`.

## Commands

- `npm run dev` — dev server with Turbopack
- `npm run build` — production build (use to validate before reporting done)
- `npm run lint` — ESLint (React 19 strict rules enabled — no setState in effect bodies, no ref access during render)
- `npx tsc --noEmit` — typecheck only

## Architecture

**Single source of truth = Supabase Postgres.** UI is a projection of `leads.status`. Realtime subscriptions sync changes between SDR and Closer without polling.

### Data model

- `leads` — central table. Status enum drives the kanban column. Triggers in Postgres append to `lead_events` on every status change (cannot be bypassed by client).
- `lead_events` — append-only history. UI never inserts directly; it reads to render the timeline.
- `user_goals` — one row per owner (SDR / Closer). For SDR the `daily_goal`/`weekly_goal` mean appointments scheduled; for Closer they mean deals won.

### Phase 2.1 schema additions

`leads` has fields for B2B qualification:
- Decisor / empresa: `cargo`, `empresa`, `instagram`
- Qualificação (enums): `estoque`, `historico`, `estrutura`
- BANT (enums): `bant_budget`, `bant_authority`, `bant_need`, `bant_timing`
- Agendamento: `data_agendamento`, `google_event_id`, `google_calendar_id` (last two unused until Phase 2.4)

### Frontend layout

- `app/layout.tsx` wraps everything in `<AppShell>` which provides:
  - `LeadsProvider` — single `useLeads()` subscription shared via context (`useLeadsContext()`). Pages never call `useLeads()` directly to avoid duplicate realtime channels.
  - `<Sidebar />` — fixed left, hover-expand (16px → 224px). Mobile: `<MobileBottomNav />` instead.
- Routes:
  - `/` → Dashboard (KPIs, funil, próximas reuniões)
  - `/kanban` → Kanban board
  - `/agenda` → Placeholder (built in 2.3)
- `<TopBar>` is rendered per-page (not in layout) so each page sets its own title. It reads leads from context and shows SDR + Closer goal gauges.

### Conventions

- All UI text in pt-BR.
- Dark theme always. Background `#0a0a0a`. Brand accent `#f5c518` (hover `#ffd633`). Status badges use Tailwind hue/10 + hue/30 borders.
- Optimistic updates with rollback in `useLeads.updateLead`. Snapshot before patch, restore on Supabase error.
- Drag-and-drop: card is the drag handle (whole card). For nested interactive elements (WhatsApp link), stop both `onClick` AND `onPointerDown` to prevent drag activation.
- Brazilian phone → wa.me link via `whatsappLink(telefone)` helper in `lib/types.ts`. Defaults to country code 55 if not provided.

### React 19 gotchas this codebase respects

- Never `useRef(createClient()).current` — refs aren't allowed during render. Use a module-level singleton (`getSupabase()`).
- Never `setState` synchronously inside `useEffect` for prop syncing. Use `key={lead.id}` on the parent to force remount instead.
- LeadDetailsPanel is rendered only when `selectedLead` exists, with `key={selectedLead.id}` — guarantees fresh state per lead.

## Migrations

SQL migrations live in `supabase/migrations/`. They are applied manually via Supabase SQL Editor (no CLI workflow yet).

- `001_init.sql` — core schema, triggers, RLS, realtime
- `002_phase2_b2b.sql` — B2B fields, Closer goals
- `012` / `014` — funil status enum: adiciona `qualificado` e `em_agendamento` (ordem: qualificado → em_agendamento → reuniao_agendada → …)
- `015` — vincula `team_members.email` às contas de login (usado pra identificar o usuário logado)
- `017` — `leads.reuniao_realizada_em` (gatilho: sai de reuniao_agendada p/ ganho/perdido/follow_up) + `leads.criativo_codigo` (int, rastreio de anúncio). Estende `set_status_timestamps` e faz backfill via `lead_events`.
- `019` — `ad_investments.leads_ads` (leads/mensagens dos anúncios por período, entrada manual; base do custo por lead).
- `020` — garante realtime de `ad_investments` (publicação + replica identity full).
- `021` — `leads.origem` ('manual' | 'whatsapp') pra rastrear leads que entraram pela integração.
- `024` / `025` — etapa **`sem_resposta`** (pulmão de recontato, não-descarte) no enum (024, sozinha) + RLS liberando o SDR (025). Auto-move: Vercel Cron diário (`vercel.json` → `/api/cron/stale-leads`, 9h UTC) move leads parados em `qualificado` (Entrada) há > `STALE_LEAD_DAYS` (=7) dias pra `sem_resposta`. Rota protegida por `CRON_SECRET` (Authorization Bearer, ou `?token=`); usa service_role. Middleware libera `/api/cron`. SDR recupera arrastando de volta.
- `022` / `023` — etapa **`desqualificado`** no enum (022, rodar sozinha) + coluna `leads.motivo_desqualificacao` (text) e RLS liberando o SDR a desqualificar (023). Popup de motivo em `DisqualifyDialog`; motivos em `MOTIVO_DESQUALIFICACAO_LABELS`; relatório "Motivos de desqualificação".
- `018` — papel "Gestor de tráfego" (`team_members.role` aceita 'Trafego'; helper `app_is_traffic()`), insere Eduardo (eduardo@floowdigital.com), e cria `ad_investments` (investimento de ads por período, trava de sobreposição via EXCLUDE gist, RLS leitura=autenticado/escrita=admin+trafego). Rodar DEPOIS da 016.
- `028` — etapa **`agendando`** ("Em agendamento") no enum, entre `em_agendamento` e `reuniao_agendada`. Rodar SOZINHA (ALTER TYPE ADD VALUE). Voltar um lead de `reuniao_agendada` pra essa etapa limpa o agendamento (igual qualificado/em_agendamento/no_show em `useLeads.updateLead`).
- `029` — rastreio de **no-shows seguidos**: `leads.no_show_count` (int default 0) + `leads.last_no_show_em` (timestamptz). Estende `set_status_timestamps`: ao entrar em `no_show` guarda `OLD.data_agendamento` em `last_no_show_em` e incrementa o contador; quando a reunião acontece (sai de `reuniao_agendada` p/ ganho/perdido/follow_up/carteira) zera o contador. 2+ → aviso vermelho no `LeadCard`. Backfill via `lead_events`. Rodar DEPOIS da 028.
- **Período global + Financeiro por dados** (pós-033): seletor de período reutilizável `PeriodPicker` (presets hoje/ontem/7d/14d/30d/tudo + intervalo personalizado via calendário) ligado ao `PeriodProvider` (contexto global, persiste em localStorage). Modelo em `lib/reports.ts`: `PeriodSelection`, `resolveRange()`, `filterLeadsByRange()`, `faturamentoInRange()`, `ganhosInRange()`. Aplicado em Dashboard, Relatórios e Financeiro. **Financeiro** virou painel de dados (sem lançamento manual): lê gasto da Meta (`useMetaSpendContext`), mostra Investido/Faturamento/Lucro/ROAS/CPL/CAC/Ticket + gasto dia a dia, com botão "Sincronizar com a Meta". Helpers `metaSpendInWindow`/`metaLeadsInWindow` em `lib/finance.ts`. `ad_investments` (manual) segue no banco mas não é mais exposto no Financeiro.
- `033` — **integração Meta Ads (gasto automático)**: tabela `meta_ad_spend_daily` (1 linha/dia: spend, leads, impressions, clicks) preenchida por `/api/meta/sync` (UPSERT por dia, service_role; RLS leitura=autenticado). Cliente da Marketing API em `lib/meta/insights.ts` (`fetchDailyInsights(since,until)`, env `META_ACCESS_TOKEN`/`META_AD_ACCOUNT_ID`/`META_API_VERSION`). Rota `/api/meta/sync?days=N` autoriza por `CRON_SECRET` (Bearer, cron da Vercel diária 6h UTC em `vercel.json`) OU sessão de admin (botão no Financeiro). Middleware libera `/api/meta`. Granularidade diária → soma exata por intervalo (sem rateio). `leads` = actions de mensagem/lead (`LEAD_ACTION_TYPES`, ajustável). **Pendente**: fiação do Financeiro/Relatórios pra ler dessa tabela (feito após validar o token real).
- `032` — `leads.produto` (text: 'aceleracao'|'floow_insta'|'floow_catalogo') = produto ofertado, **obrigatório na qualificação** (`isQualComplete` no kanban, `NewLeadDialog` e `CompleteQualificationDialog`). Ao selecionar, pré-preenche `leads.valor` com `PRODUTO_VALORES` (aceleração R$1397 · insta R$397 · catálogo R$97) — editável depois; no painel do lead só preenche se `valor` estiver vazio (não sobrescreve). Filtro por produto no kanban. `PRODUTO_LABELS`/`PRODUTO_VALORES`/`PRODUTO_OPTIONS` em `lib/types.ts`. Coluna editável no painel: **Data de entrada no funil** (`created_at`) agora é editável (`EditableDateRow allowClear={false}`); `UpdateLeadInput` em `useLeads` deixou de omitir `created_at`.
- `030` — `leads.fonte` (text: 'meta_ads'|'indicacao'|'outbound'|'outro') = fonte de marketing (read-only no card + select no `LeadDetailsPanel`). Webhook do WhatsApp grava `fonte='meta_ads'`. Backfill: `origem='whatsapp'`→`meta_ads`. NÃO confundir com `origem` (controle interno 'manual'|'whatsapp'). Relatórios: `buildSourceStats` ("Por origem (fonte)") + coluna no CSV.
- `016` — RLS com papéis no banco (antes era só `auth.role() = 'authenticated'`). Adiciona coluna `team_members.is_admin` (admin vira dado, não email fixo) e helpers SECURITY DEFINER (`app_is_admin`, `app_is_closer`, `app_owns_lead`, `app_owns_goal`) que cruzam `auth.email()` × `team_members`. Regras: leads UPDATE trava a zona do Closer pro SDR (status resultante só pode ser etapa SDR); leads DELETE só admin/dono; team_members escrita só admin (API routes com service_role ignoram RLS); user_goals cada um edita a meta do próprio papel. SELECT continua aberto a autenticados (de propósito). `app_is_admin()` lê `is_admin` com fallback no email `rafe@floowdigital.com` (rede de segurança, espelha `ADMIN_EMAIL` em `lib/types.ts`). Client: `TeamContext.isAdmin` = `currentMember.is_admin || isAdminEmail(email)`; TopBar só mostra o lápis de meta pro dono do papel/admin. Rollback: `016_rls_permissions_rollback.sql`.

## Phased delivery — current state

- Phase 1 (done) — Kanban, lead CRUD, status history, SDR goals, Supabase realtime
- Phase 2.1 (done) — Sidebar nav, Dashboard, B2B lead form with BANT obrigatório, WhatsApp button, Closer goals
- Phase 2.2 (done) — Gamification: pontos, streak, nível, badges, ranking SDR vs Closer (all derived from `lead_events`)
- Phase 2.3 (done) — Agenda visual com toggle mês/semana, navegação por período, click → painel lateral
- Phase 2.7 (done) — Etapa "Em agendamento"; papéis/permissões (admin, zona do Closer travada pro SDR); filtro por responsável (só admin); gestão de usuários self-service; celebrações (dopamina) ao agendar/ganhar
- Phase 3 (done) — WhatsApp lead capture via Z-API (webhook `app/api/webhooks/whatsapp/route.ts`): leads do anúncio entram em "Entrada" gateados por código `[NN]`, roteamento de SDR por número (`WHATSAPP_NUMBER_MAP`), `origem='whatsapp'`, `fonte='meta_ads'`
- Phase 4 (MVP done) — **Extensão Chrome sobre o WhatsApp Web** (`whatsapp-extension/`). Ver seção abaixo.

### Extensão WhatsApp (Phase 4)

Diretório `whatsapp-extension/` (projeto à parte, vanilla TS + esbuild, NÃO faz parte do build Next). Painel injetado em `web.whatsapp.com` via content script que conversa direto com o mesmo Supabase (anon key embutida no build via `build.mjs` lendo `../.env.local`).
- `src/content.ts` — UI do painel (DOM puro, escopado em `#floow-*`) + login Supabase (sessão em `chrome.storage.local`) + realtime + ações.
- `src/whatsapp.ts` — lê a conversa aberta (`#main header span[title]`); frágil por design (HTML ofuscado), busca manual é a rede de segurança.
- `src/crm.ts` — espelho enxuto de tipos/labels/`canMoveTo`/`normalizePhone` do app. Manter em sincronia se o funil mudar.
- Só move pra `SAFE_STAGES` (sem dialogs de info extra); respeita RLS por papel. Build: `cd whatsapp-extension && npm install && npm run build` → carrega `dist/` em `chrome://extensions` (modo dev). `dist/` é commitado pra instalar sem buildar.

### Papéis e permissões (Phase 2.7)

Identidade do usuário = cruzamento `team_members.email` × email da sessão Supabase Auth, feito em `TeamContext`:
- `currentMember` — o membro do time correspondente ao login.
- `isAdmin` — `email === ADMIN_EMAIL` (`rafe@floowdigital.com`, constante em `lib/types.ts`). Admin é fixo; não há coluna no banco.
- Helpers em `lib/types.ts`: `isAdminEmail()`, `SDR_STAGES` (qualificado/em_agendamento/reuniao_agendada), `canMoveTo(status, {role, isAdmin})`.

Regras:
- **Visibilidade do funil** (`app/kanban/page.tsx`, `visibleLeads`): admin vê tudo + filtro por responsável; SDR/Closer veem só leads onde são `sdr_responsavel`/`closer_responsavel`.
- **Zona do Closer**: da `reuniao_agendada` em diante (no_show, follow_up, carteira, ganho, perdido) o SDR não move cards — colunas ficam mais escuras + cadeado (`Column locked`, droppable `disabled`). Closer e admin movem livremente. A trava é aplicada no Board (DnD), na LeadDetailsPanel ("Mover para") e via `canMoveTo`.
- **Dono padrão do lead**: `NewLeadDialog` pré-seleciona `dono` = `currentMember.role`.

### Gestão de usuários (Phase 2.7)

Só o admin gerencia (card "Usuários" em `/configuracoes`). Cria contas de login de verdade via API routes server-side com service_role:
- `POST /api/team/create-user` — cria auth user (senha temporária, `email_confirm: true`) + linha em `team_members`. Rollback do auth se a inserção falhar.
- `POST /api/team/delete-user` — desativa em `team_members` + apaga o login.
- Ambas passam por `app/api/team/guard.ts` (`getAdminSupabaseGuard`) que exige sessão e `isAdminEmail`. Expostas no client via `TeamContext.createUser/removeUser`.

### Celebrações (Phase 2.7)

`components/ui/Celebration.tsx` — overlay full-screen, `pointer-events-none`, auto-dismiss ~1.8s. `kind: 'meeting'` (reuniao_agendada) e `'win'` (negocio_ganho, sino + dinheiro). Disparado de `app/kanban/page.tsx` (`triggerCelebration`) após mover/criar/completar pra esses status. Partículas usam pseudo-random **determinístico** (`Math.sin`) — `Math.random` durante render quebra a regra `react-hooks/purity` do React 19. Animações em `globals.css` (`floow-*`).

### Gamification details (Phase 2.2)

All metrics are **derived client-side from `leads` + `lead_events`** — no extra tables. See `lib/gamification.ts`:
- `computePoints(leads, events, owner)` — SDR: +10 por agendamento criado, -5 por no-show. Closer: +20 por reunião realizada, +100 por negócio ganho + 1% do valor.
- `computeStreak(leads, events, goal, owner)` — dias consecutivos batendo `daily_goal`. Today doesn't break streak (dia ainda em curso).
- `computeLevel(points)` — Bronze 0-500 · Prata 501-2000 · Ouro 2001-5000 · Diamante 5001+
- `computeBadges(...)` — derivados das contagens (primeira venda, streak 5/15, big deal, low no-show, 10 fechamentos…).
- `computeWeeklyPoints(...)` — pontos só na semana corrente (pra ranking).

Hook `useAllLeadEvents()` busca os últimos 2000 eventos com realtime INSERT. Não está em contexto (single subscription, só Dashboard usa). Se for usado em outro lugar, mover pra context pra evitar canais duplicados.

### Agenda details (Phase 2.3)

`app/agenda/page.tsx` controla `cursor` (Date) + `view` (`'mes' | 'semana'`). Os componentes (`MonthView`, `WeekView`) são puros e recebem os leads. Reuniões são leads com `data_agendamento` preenchido. Cores seguem `STATUS_COLORS` do lead.
- Month grid: 7×6 (sempre 42 células), dias fora do mês ficam acinzentados, "+N mais" se passar de 3 reuniões no dia.
- Week timeline: 7 colunas, 7h-21h, posição vertical proporcional ao minuto.

## Conventions to maintain

- Don't add features beyond the current phase. User gates each phase.
- Keep components in language-aware structure: `app/<route>/page.tsx`, `components/<area>/...`, `lib/...`.
- Update this file when schema changes or new architectural patterns emerge.
