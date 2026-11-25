import { supabase } from "./supabaseClient";
import { APP_URL, ADMIN_EMAIL } from "./config";
import { extWebphone } from "./webphone";
import {
  type Lead,
  type LeadStatus,
  type AudioSnippet,
  type CannedMessage,
  LEAD_COLUMNS,
  STATUS_LABELS,
  STATUS_ORDER,
  STATUS_DOT,
  leadTemperature,
  FONTE_LABELS,
  FONTE_OPTIONS,
  origemLabel,
  creativeCodeClean,
  CALL_OUTCOME_LABELS,
  CALL_OUTCOME_PHONE_LABELS,
  TASK_TIPO_OPTIONS,
  TASK_TIPO_LABELS,
  TASK_TIPO_ICONS,
  TASK_TIPO_COLORS,
  STAGE_TASK_TIPO,
  msgConfirmacao,
  msgLembrete,
  msgProposta,
  suggestedTaskDue,
  taskTitleFor,
  QUAL_FIELDS,
  ESTADO_OPTIONS,
  UF_LABELS,
  cidadesForUf,
  SEGMENTO_LABELS,
  SEGMENTO_OPTIONS,
  MOTIVO_PERDA_LABELS,
  MOTIVO_DESQUALIFICACAO_PICK,
  MOTIVO_CARTEIRA_LABELS,
  motivoDaEtapa,
  NO_QUAL_STAGES,
  BUSINESS_STAGES,
  canMoveTo,
  isPreQualComplete,
  needsBusinessInfo,
  needsQualification,
  patchForStatus,
  normalizePhone,
  samePhone,
  looksLikePhone,
} from "./crm";
import { readActiveChatPhone, readActiveChatTitle, readChatDebug, startNativeCall, openWhatsAppChat, scrapeConversationHistory, scrapeDebug } from "./whatsapp";

// ============================================================
// Estado
// ============================================================
let authed = false;
let sessionEmail: string | null = null;
let member: { name: string | null; role: string | null; isAdmin: boolean; recordCalls: boolean } = { name: null, role: null, isAdmin: false, recordCalls: true };
let leads: Lead[] = [];
let closers: { id: string; name: string }[] = [];
let sdrs: { id: string; name: string }[] = [];
let audios: AudioSnippet[] = [];
let cannedMsgs: CannedMessage[] = [];
let currentLeadId: string | null = null;
let matchInfo = "";
let lastPhone: string | null = null;
let collapsed = true;
let searchMode = false;
let lastTitle: string | null = null;
let lastKey = "";
// Navegação do "funil de vendas" dentro da extensão.
let view: "lead" | "funnel" | "stage" | "tasks" = "lead";
let sdrFilter: string | null = null; // admin: filtra o funil por responsável (null=meu · "__all__"=todos · nome=SDR)
let taskTipoFilter: string | null = null; // filtro por tipo na agenda de tarefas
let taskDateFilter: "todas" | "atrasadas" | "hoje" = "todas"; // filtro por data da tarefa
let stageFilter: LeadStatus | null = null;   // etapa cuja lista está aberta
let returnStage: LeadStatus | null = null;    // pra "voltar ao funil" após abrir a conversa
// "Fixado" = lead aberto pelo funil (detalhes), mesmo sem a conversa dele aberta.
// Enquanto fixado, o watcher da conversa NÃO troca o lead exibido.
let pinned = false;

// A conversa aberta é a desse lead? Casa por telefone, pelo @lid vinculado, OU pelo
// NOME do contato salvo (quando o WhatsApp não expõe telefone/@lid). samePhone trata LID.
function chatMatchesLead(lead: Lead): boolean {
  const p = readActiveChatPhone();
  if (p && (samePhone(lead.telefone, p) || (!!lead.wa_lid && samePhone(lead.wa_lid, p)))) return true;
  const title = (readActiveChatTitle() || "").trim();
  if (title && lead.wa_contact_name && lead.wa_contact_name.trim() === title) return true;
  return false;
}

// Abre os DETALHES do lead (fixado) a partir do funil, sem abrir a conversa.
function openLeadDetail(lead: Lead) {
  currentLeadId = lead.id;
  pinned = true;
  returnStage = lead.status;
  matchInfo = "aberto pelo funil";
  view = "lead";
  render();
}

// Ligações de HOJE por lead (id → contagem). Colore os cards do funil.
let callsToday = new Map<string, number>();

async function loadCallsToday() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const { data } = await supabase
    .from("lead_events")
    .select("lead_id")
    .eq("tipo", "ligacao")
    .gte("created_at", start.toISOString());
  const m = new Map<string, number>();
  for (const e of (data ?? []) as { lead_id: string }[]) m.set(e.lead_id, (m.get(e.lead_id) ?? 0) + 1);
  callsToday = m;
}

// Cor do card conforme nº de ligações HOJE: 0 frio(azul) · 1 amarelo · 2 laranja
// · 3 vermelho · 4+ vinho.
function callHeat(n: number): string {
  if (n >= 4) return "#8b1a2b"; // vinho
  if (n === 3) return "#ef4444"; // vermelho
  if (n === 2) return "#f97316"; // laranja
  if (n === 1) return "#eab308"; // amarelo
  return "#3b82f6";              // azul (frio)
}

// Zona de cadência (onde o relógio de 20 dias / a cobrança de toque valem): da
// Entrada até "Qualificado". Igual ao CADENCE_STAGES de lib/types.ts.
const CADENCE_STAGES_EXT: LeadStatus[] = ["qualificado", "pre_qualificado", "em_agendamento"];

// 3 BOLINHAS = os toques (ligações) do DIA. Cada ligação pinta uma de amarelo;
// zeram todo dia. Na zona de cadência, bolinha vazia fica âmbar cobrando o toque
// que falta. Fora da cadência, só mostra o que já foi ligado (sem cobrança).
function touchDots(n: number, status: LeadStatus): HTMLElement {
  const GOAL = 3;
  const filled = Math.min(Math.max(n, 0), GOAL);
  const inCad = CADENCE_STAGES_EXT.includes(status);
  const missing = inCad && filled < GOAL;
  return h(
    "span",
    {
      style: "display:inline-flex;gap:3px;align-items:center;",
      title: inCad
        ? `Toques de hoje: ${filled}/${GOAL}${filled >= GOAL ? " ✅" : " · falta ligar"}`
        : `Ligações hoje: ${n}`,
    },
    Array.from({ length: GOAL }).map((_, i) => {
      const on = i < filled;
      const bg = on ? "#f5c518" : missing ? "#f59e0b33" : "transparent";
      const bd = on ? "#f5c518" : missing ? "#f59e0b" : "#52525b";
      return h("span", {
        style: `width:9px;height:9px;border-radius:9999px;background:${bg};border:1px solid ${bd};`,
      });
    }),
  );
}

// Número discável (com 55) do lead. null se for @lid (sem número real).
function leadDigits(lead: Lead): string | null {
  if (!lead.telefone || lead.telefone.includes("@lid")) return null;
  let d = lead.telefone.replace(/\D/g, "");
  if (!d) return null;
  if (d.length <= 11) d = "55" + d.replace(/^55/, "");
  return d;
}

// ============================================================
// Helper de DOM
// ============================================================
function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: Partial<Record<string, unknown>> = {},
  children: (Node | string)[] = [],
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === "class") el.className = String(v);
    else if (k === "style") el.setAttribute("style", String(v));
    else if (k.startsWith("on") && typeof v === "function") el.addEventListener(k.slice(2).toLowerCase(), v as EventListener);
    else if (v != null) el.setAttribute(k, String(v));
  }
  for (const c of children) el.append(c instanceof Node ? c : document.createTextNode(c));
  return el;
}

function currentLead(): Lead | null {
  return leads.find((l) => l.id === currentLeadId) ?? null;
}

// Pode editar o lead? Admin sempre; senão só o SDR/Closer responsável. Se for de
// outra pessoa, trava (só leitura).
function canEditLead(lead: Lead): boolean {
  if (member.isAdmin) return true;
  return lead.sdr_responsavel === member.name || lead.closer_responsavel === member.name;
}

// ============================================================
// Painel (raiz)
// ============================================================
let panel: HTMLElement;
let body: HTMLElement;
let fab: HTMLElement;
let connDot: HTMLElement;
let searchBarEl: HTMLElement | null = null;

function mount() {
  if (document.getElementById("floow-panel")) return;
  fab = h("button", { id: "floow-fab", title: "floow CRM", onclick: toggle }, ["∞"]);
  connDot = h("span", { id: "floow-conn", class: "off" });
  const header = h("div", { id: "floow-head" }, [
    h("div", { class: "floow-brand" }, [connDot, "floow CRM"]),
    h("button", { class: "floow-x", title: "Fechar", onclick: toggle }, ["×"]),
  ]);
  body = h("div", { id: "floow-body" });
  searchBarEl = buildSearchBar();
  panel = h("div", { id: "floow-panel", class: "collapsed" }, [header, searchBarEl, body]);
  document.body.append(fab, panel);
}

function toggle() {
  collapsed = !collapsed;
  panel.classList.toggle("collapsed", collapsed);
  fab.classList.toggle("hidden", !collapsed);
  if (!collapsed) render();
}

// Expande o painel (sem alternar) — usado pelos alertas ("Abrir informações").
function expandPanel() {
  collapsed = false;
  if (panel) panel.classList.remove("collapsed");
  if (fab) fab.classList.add("hidden");
}

function setConn(state: "on" | "off") {
  if (connDot) connDot.className = state;
}

// ============================================================
// Render
// ============================================================
function render() {
  if (!body || collapsed) return;
  body.replaceChildren();
  if (searchBarEl) searchBarEl.style.display = (authed && !searchMode) ? "" : "none";
  if (!authed) return renderAuth();
  if (searchMode) return renderSearch();
  if (view === "funnel") return renderFunnel();
  if (view === "stage") return renderStageList();
  if (view === "tasks") return renderTasksAgenda();
  renderLead();
}

// Barra de navegação (topo do corpo): funil + agenda de tarefas do dia.
function renderNav(): Node {
  const funil = h("button", { class: "floow-nav-btn" }, ["📋 Ir para funil de vendas"]);
  funil.addEventListener("click", async () => { await loadCallsToday(); view = "funnel"; render(); });
  const agenda = h("button", { class: "floow-nav-btn floow-nav-tasks" }, ["🗓️ Minhas tarefas de hoje"]);
  agenda.addEventListener("click", () => { view = "tasks"; render(); });
  return h("div", { class: "floow-nav" }, [funil, agenda]);
}

// Agenda: tarefas atrasadas + de hoje do usuário. Concluir + abrir a conversa.
async function renderTasksAgenda() {
  const back = h("button", { class: "floow-link" }, ["← Conversa atual"]);
  back.addEventListener("click", () => { view = "lead"; render(); });
  const head = h("div", { class: "floow-section" }, [
    h("div", { class: "floow-row" }, [h("div", { class: "floow-title" }, ["Minhas tarefas de hoje"]), back]),
  ]);
  body.append(head);

  const container = h("div", { class: "floow-section" }, [h("div", { class: "floow-hint" }, ["carregando…"])]);
  body.append(container);

  const end = new Date(); end.setHours(23, 59, 59, 999);
  const { data } = await supabase
    .from("tasks")
    .select("id,titulo,descricao,due_at,tipo,lead_id,assignee,recorrente")
    .eq("done", false)
    .eq("assignee", member.name)
    .lte("due_at", end.toISOString())
    .order("due_at", { ascending: true });
  const rows = (data ?? []) as { id: string; titulo: string; descricao: string | null; due_at: string | null; tipo: string; lead_id: string | null; assignee: string | null; recorrente: boolean }[];

  container.replaceChildren();
  if (rows.length === 0) { container.append(h("div", { class: "floow-hint" }, ["Nenhuma tarefa pra hoje. 🎉"])); return; }

  const today0 = new Date(); today0.setHours(0, 0, 0, 0);
  const fmt = (iso: string | null) => {
    if (!iso) return "";
    const d = new Date(iso); const p = (n: number) => String(n).padStart(2, "0");
    return `${p(d.getHours())}:${p(d.getMinutes())}`;
  };

  // 1) Filtro por DATA (Atrasado / Hoje). "Todas" mostra tudo.
  const dateBar = h("div", { class: "floow-pills", style: "margin-bottom:6px" });
  const mkDate = (val: typeof taskDateFilter, label: string) => {
    const b = h("button", { class: "floow-pill" + (taskDateFilter === val ? " sel" : "") }, [label]);
    b.addEventListener("click", () => { taskDateFilter = val; renderTasksAgenda_refresh(); });
    return b;
  };
  dateBar.append(mkDate("todas", "Todas"), mkDate("atrasadas", "Atrasadas"), mkDate("hoje", "Hoje"));
  container.append(dateBar);

  // 2) Filtro por TIPO (Agendar / Follow-up / …). "Todas" limpa o filtro.
  const bar = h("div", { class: "floow-pills", style: "margin-bottom:8px" });
  const mkPill = (val: string | null, label: string) => {
    const b = h("button", { class: "floow-pill" + (taskTipoFilter === val ? " sel" : "") }, [label]);
    b.addEventListener("click", () => { taskTipoFilter = val; renderTasksAgenda_refresh(); });
    return b;
  };
  bar.append(mkPill(null, "Todas"));
  for (const tp of TASK_TIPO_OPTIONS) bar.append(mkPill(tp, TASK_TIPO_LABELS[tp]));
  container.append(bar);

  const byType = taskTipoFilter ? rows.filter((t) => (t.tipo || "outro") === taskTipoFilter) : rows;
  const isAtrasada = (t: typeof rows[number]) => !!t.due_at && new Date(t.due_at) < today0;
  const allGroups: { label: string; items: typeof rows }[] = [
    { label: "Atrasadas", items: byType.filter(isAtrasada) },
    { label: "Hoje", items: byType.filter((t) => !isAtrasada(t)) },
  ];
  const groups = allGroups.filter((g) =>
    taskDateFilter === "todas" ||
    (taskDateFilter === "atrasadas" && g.label === "Atrasadas") ||
    (taskDateFilter === "hoje" && g.label === "Hoje"),
  );
  if (groups.every((g) => g.items.length === 0)) {
    container.append(h("div", { class: "floow-hint" }, ["Nenhuma tarefa com esses filtros."]));
    return;
  }

  for (const g of groups) {
    if (g.items.length === 0) continue;
    const wrap = h("div", { style: "margin-bottom:10px" }, [
      h("div", { class: "floow-title", style: g.label === "Atrasadas" ? "color:#fb7185" : "" }, [`${g.label} (${g.items.length})`]),
    ]);
    for (const t of g.items) {
      const lead = t.lead_id ? leads.find((l) => l.id === t.lead_id) : null;
      const color = TASK_TIPO_COLORS[t.tipo] || "#71717a";
      const check = h("button", { class: "floow-task-check", title: "Concluir" }, ["○"]);
      check.addEventListener("click", async (e: Event) => {
        e.stopPropagation();
        check.textContent = "…";
        const ok = await concluirTarefa(t);
        if (ok) renderTasksAgenda_refresh(); else check.textContent = "○";
      });
      const row = h("div", { class: "floow-task-row", style: `border-left:3px solid ${color}; cursor:pointer`, title: "Editar / copiar mensagens" }, [
        check,
        h("div", { style: "flex:1;min-width:0" }, [
          h("div", { class: "floow-task-title" }, [`${t.recorrente ? "🔁 " : ""}${TASK_TIPO_ICONS[t.tipo] || "📌"} ${t.titulo}`]),
          lead ? h("div", { class: "floow-leaditem-sub" }, [lead.empresa || lead.nome || ""]) : document.createTextNode(""),
        ]),
        t.due_at ? h("span", { class: "floow-task-due" }, [fmt(t.due_at)]) : document.createTextNode(""),
      ]);
      row.addEventListener("click", () => { editTaskModal(t, lead ?? null).then(() => renderTasksAgenda_refresh()); });
      wrap.append(row);
    }
    container.append(wrap);
  }
}
// Re-render helper (mantém a view em "tasks").
function renderTasksAgenda_refresh() { if (view === "tasks") render(); }

// ============================================================
// NOTIFICAÇÃO DE TAREFA NO HORÁRIO (alerta na tela + notificação do sistema)
// Checa a cada 30s as tarefas do usuário que venceram; avisa 1x cada.
// ============================================================
let taskNotifierTimer: ReturnType<typeof setInterval> | null = null;
const notifiedTaskIds = new Set<string>();

async function startTaskNotifier() {
  try { if (typeof Notification !== "undefined" && Notification.permission === "default") await Notification.requestPermission(); } catch { /* noop */ }
  if (taskNotifierTimer) return;
  const check = async () => {
    if (!member.name) return;
    const now = Date.now();
    const soon = new Date(now + 30_000).toISOString();         // já no horário (ou quase)
    const floor = new Date(now - 10 * 60_000).toISOString();   // pega as que venceram nos últimos 10 min
    const { data } = await supabase
      .from("tasks")
      .select("id,titulo,descricao,due_at,lead_id,tipo")
      .eq("assignee", member.name).eq("done", false)
      .lte("due_at", soon).gte("due_at", floor)
      .order("due_at", { ascending: true });
    for (const t of (data as { id: string; titulo: string; descricao: string | null; due_at: string | null; lead_id: string | null; tipo: string }[]) ?? []) {
      if (notifiedTaskIds.has(t.id)) continue;
      notifiedTaskIds.add(t.id);
      showTaskAlert(t);
    }
  };
  check();
  taskNotifierTimer = setInterval(check, 30_000);
}

function showTaskAlert(t: { id: string; titulo: string; descricao: string | null; due_at: string | null; lead_id: string | null; tipo: string }) {
  const lead = t.lead_id ? leads.find((l) => l.id === t.lead_id) : null;
  const quem = lead ? (lead.empresa || lead.nome || "") : "";
  const hora = t.due_at ? new Date(t.due_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "";
  const icon = TASK_TIPO_ICONS[t.tipo] || "📌";

  // Notificação do sistema (aparece mesmo com o painel fechado/minimizado).
  try {
    if (typeof Notification !== "undefined" && Notification.permission === "granted") {
      const n = new Notification(`${icon} ${t.titulo}`, { body: (quem ? quem + " · " : "") + (hora ? "agendada p/ " + hora : "está na hora"), tag: `floow-task-${t.id}` });
      n.onclick = () => { window.focus(); if (lead) openConversation(lead); n.close(); };
    }
  } catch { /* noop */ }

  // Alerta flutuante na tela (fixo, sobre o WhatsApp Web) — some sozinho em ~40s.
  const card = h("div", { class: "floow-taskalert" }, [
    h("div", { class: "floow-taskalert-top" }, [
      h("span", { class: "floow-taskalert-title" }, [`${icon} ${t.titulo}`]),
      h("button", { class: "floow-taskalert-x", title: "Fechar" }, ["×"]),
    ]),
    h("div", { class: "floow-taskalert-sub" }, [`${quem ? quem + " · " : ""}${hora ? "⏰ " + hora : "agora"}`]),
    h("div", { class: "floow-taskalert-actions" }, []),
  ]);
  const actions = card.querySelector(".floow-taskalert-actions") as HTMLElement;
  const close = () => { card.remove(); };
  (card.querySelector(".floow-taskalert-x") as HTMLElement).addEventListener("click", close);

  if (lead) {
    const conv = h("button", { class: "floow-taskalert-btn primary" }, ["💬 Abrir conversa"]);
    conv.addEventListener("click", () => { openConversation(lead); close(); });
    actions.append(conv);
  }
  const done = h("button", { class: "floow-taskalert-btn" }, ["✓ Concluir"]);
  done.addEventListener("click", async () => {
    await concluirTarefa({ ...t, recorrente: false });
    flash("Tarefa concluída ✓"); close();
  });
  actions.append(done);

  getAlertHost().append(card);
  setTimeout(() => { if (card.isConnected) card.remove(); }, 40_000);
}

// Container fixo pros alertas (fora do painel, pra aparecer mesmo colapsado).
let alertHost: HTMLElement | null = null;
function getAlertHost(): HTMLElement {
  if (alertHost && alertHost.isConnected) return alertHost;
  alertHost = h("div", { id: "floow-alert-host" });
  document.body.append(alertHost);
  return alertHost;
}

// ============================================================
// NOTIFICAÇÃO DE LEAD (novo lead entrou / lead atribuído a você)
// Disparado pelo realtime (ver subscribeRealtime). Alerta na tela + do sistema,
// com botões "Ir para conversa" e "Abrir informações".
// ============================================================
const notifiedNewLeadIds = new Set<string>();
const notifiedAssignKeys = new Set<string>();

function maybeNotifyLead(eventType: string, row: Lead, prev: Lead | undefined) {
  if (!authed || !member.name) return;

  // (1) NOVO LEAD entrou no CRM (INSERT). Avisa o SDR dono — e o admin (vê todos).
  if (eventType === "INSERT" && !prev) {
    if (!(member.isAdmin || row.sdr_responsavel === member.name)) return;
    if (notifiedNewLeadIds.has(row.id)) return;
    notifiedNewLeadIds.add(row.id);
    showLeadAlert(row, "novo");
    return;
  }

  // (2) LEAD ATRIBUÍDO A MIM: o sdr_responsavel MUDOU pra meu nome (ex.: admin
  // enviou o lead pra este SDR). Compara com o estado local (prev) — não depende
  // de REPLICA IDENTITY FULL.
  if (eventType === "UPDATE" && prev && row.sdr_responsavel === member.name && prev.sdr_responsavel !== member.name) {
    const key = `${row.id}:${row.sdr_responsavel}`;
    if (notifiedAssignKeys.has(key)) return;
    notifiedAssignKeys.add(key);
    showLeadAlert(row, "atribuido");
  }
}

function showLeadAlert(lead: Lead, kind: "novo" | "atribuido") {
  const quem = lead.empresa || lead.nome || "Lead";
  const digits = leadDigits(lead);
  const telTxt = digits ? digits.replace(/^55/, "") : "";
  const title = kind === "novo" ? "🆕 Novo lead entrou" : "📥 Lead atribuído a você";
  const sub = quem + (telTxt ? " · " + telTxt : "");

  // Notificação do sistema (aparece mesmo com o painel fechado / WhatsApp em outra aba).
  try {
    if (typeof Notification !== "undefined" && Notification.permission === "granted") {
      const n = new Notification(title, { body: sub, tag: `floow-lead-${lead.id}-${kind}` });
      n.onclick = () => { window.focus(); openConversation(lead); n.close(); };
    }
  } catch { /* noop */ }

  // Card flutuante na tela (sobre o WhatsApp Web) — reusa o estilo do alerta de tarefa.
  const card = h("div", { class: "floow-taskalert floow-leadalert" }, [
    h("div", { class: "floow-taskalert-top" }, [
      h("span", { class: "floow-taskalert-title" }, [title]),
      h("button", { class: "floow-taskalert-x", title: "Fechar" }, ["×"]),
    ]),
    h("div", { class: "floow-taskalert-sub" }, [sub]),
    h("div", { class: "floow-taskalert-actions" }, []),
  ]);
  const actions = card.querySelector(".floow-taskalert-actions") as HTMLElement;
  const close = () => { card.remove(); };
  (card.querySelector(".floow-taskalert-x") as HTMLElement).addEventListener("click", close);

  const conv = h("button", { class: "floow-taskalert-btn primary" }, ["💬 Ir para conversa"]);
  conv.addEventListener("click", () => { openConversation(lead); close(); });
  const info = h("button", { class: "floow-taskalert-btn" }, ["📋 Abrir informações"]);
  info.addEventListener("click", () => { expandPanel(); openLeadDetail(lead); close(); });
  actions.append(conv, info);

  getAlertHost().append(card);
  setTimeout(() => { if (card.isConnected) card.remove(); }, 60_000);
}

// ZONA DO SDR (antes da reunião): cada um trabalha a PRÓPRIA carteira. Aqui todo
// mundo — INCLUSIVE o admin/Rafe — vê só os leads onde é o SDR responsável.
const SDR_ZONE = new Set(["qualificado", "pre_qualificado", "em_agendamento", "agendando", "sem_resposta"]);
// ZONA DO CLOSER (da reunião agendada pra frente): admin/closer vê TUDO.
const CLOSER_ZONE = new Set(["reuniao_agendada", "no_show", "follow_up", "carteira", "negocio_ganho", "negocio_perdido"]);

// Leads de UMA etapa, já com o filtro de visão certo pra quem está logado.
function leadsForStage(status: string): Lead[] {
  const inStage = leads.filter((l) => l.status === status);
  const me = member.name;

  // ADMIN: filtro por responsável. "Meu funil" (sdrFilter null) = eu · nome = aquele
  // SDR · "__all__" = todos. Em qualquer dos dois primeiros, a regra é por ETAPA:
  //  • Zona do SDR (pré-reunião): só os leads cujo DONO (sdr_responsavel) é a pessoa
  //    — leads de outro SDR (mesmo que EU seja o Closer) NÃO aparecem aqui.
  //  • Zona do Closer + saídas: dono (sdr) OU quem vai fechar (closer).
  if (member.isAdmin) {
    if (sdrFilter === "__all__") return inStage;
    const who = sdrFilter || me;
    if (!who) return inStage;
    if (SDR_ZONE.has(status)) return inStage.filter((l) => l.sdr_responsavel === who);
    return inStage.filter((l) => l.sdr_responsavel === who || l.closer_responsavel === who);
  }

  // NÃO-admin (SDR / Closer / SDR+Closer): vê SÓ os leads dele, POR ZONA.
  //  • Zona do SDR (pré-reunião): onde é o DONO (sdr_responsavel).
  //  • Zona do Closer (reunião agendada → no-show/follow-up/carteira/ganho/perdido):
  //    onde é o CLOSER responsável.
  // Assim um lead que o Allan captou mas que o Rafê fecha sai da vista do Allan quando
  // entra na zona do Closer (e um lead do Rafê que o Allan fecha aparece só pro Allan lá).
  if (!me) return [];
  if (CLOSER_ZONE.has(status)) return inStage.filter((l) => l.closer_responsavel === me);
  return inStage.filter((l) => l.sdr_responsavel === me);
}

// Etapas do funil, com contador de leads em cada uma.
function renderFunnel() {
  const back = h("button", { class: "floow-link" }, ["← Conversa atual"]);
  back.addEventListener("click", () => { view = "lead"; render(); });
  const head: (Node | string)[] = [
    h("div", { class: "floow-row" }, [h("div", { class: "floow-title" }, ["Funil de vendas"]), back]),
    h("div", { class: "floow-hint", style: "margin-bottom:8px" }, ["Escolha a etapa pra ver os leads."]),
  ];
  // Admin: filtro por responsável — ver o funil de outro SDR ou de TODOS os leads.
  if (member.isAdmin) {
    const sel = h("select", { class: "floow-sdrsel", style: "width:100%;margin-bottom:8px" }) as HTMLSelectElement;
    const names = [...new Set(leads.map((l) => l.sdr_responsavel).filter(Boolean) as string[])].sort();
    const addOpt = (v: string, label: string) => {
      const o = h("option", { value: v }, [label]) as HTMLOptionElement;
      if ((sdrFilter ?? "") === v) o.selected = true;
      sel.append(o);
    };
    addOpt("", "👤 Meu funil");
    for (const n of names) addOpt(n, n);
    addOpt("__all__", "🌐 Todos os leads");
    sel.addEventListener("change", () => {
      sdrFilter = sel.value || null;
      try { chrome.storage.local.set({ floow_sdr_filter: sdrFilter ?? "" }); } catch { /* noop */ }
      render();
    });
    head.push(sel);
  }
  body.append(h("div", { class: "floow-section" }, head));
  const grid = h("div", { class: "floow-funnel-grid" });
  for (const s of STATUS_ORDER) {
    const n = leadsForStage(s).length;
    const b = h("button", { class: "floow-funnel-stage" }, [
      h("span", { class: "floow-dot", style: `background:${STATUS_DOT[s]}` }),
      h("span", { class: "floow-funnel-label" }, [STATUS_LABELS[s]]),
      h("span", { class: "floow-funnel-count" }, [String(n)]),
    ]);
    b.addEventListener("click", () => { stageFilter = s; view = "stage"; render(); });
    grid.append(b);
  }
  body.append(h("div", { class: "floow-section" }, [grid]));
}

// Lista enxuta dos leads de uma etapa. Clicar → abre a conversa no WhatsApp.
function renderStageList() {
  const s = stageFilter;
  if (!s) { view = "funnel"; return renderFunnel(); }
  const back = h("button", { class: "floow-link" }, ["← Etapas"]);
  back.addEventListener("click", () => { view = "funnel"; render(); });

  // Estrela de prioridade (manual) SEMPRE no topo; depois, por TEMPERATURA
  // (mais quente — última resposta/entrada mais recente — primeiro).
  const star = (l: Lead) => (l.prioridade ? 1 : 0);
  const heat = (l: Lead) => new Date(l.last_inbound_at || l.created_at || l.updated_at || 0).getTime();
  const list = leadsForStage(s).sort((a, b) => star(b) - star(a) || heat(b) - heat(a));
  const nowMs = Date.now();

  body.append(h("div", { class: "floow-section" }, [
    h("div", { class: "floow-row" }, [
      h("div", { class: "floow-title" }, [
        h("span", { class: "floow-dot", style: `background:${STATUS_DOT[s]}` }),
        ` ${STATUS_LABELS[s]} (${list.length})`,
      ]),
      back,
    ]),
  ]));

  if (list.length === 0) {
    body.append(h("div", { class: "floow-section" }, [h("div", { class: "floow-hint" }, ["Nenhum lead nesta etapa."])]));
    return;
  }

  const wrap = h("div", { class: "floow-stagelist" });
  for (const lead of list) {
    const digits = leadDigits(lead);
    const n = callsToday.get(lead.id) ?? 0;
    // Botão de conversa (só se tem número). Clicar no card = ver detalhes.
    const waBtn = digits
      ? h("button", { class: "floow-leaditem-wa", title: "Abrir conversa no WhatsApp" }, ["💬"])
      : document.createTextNode("");
    if (digits) (waBtn as HTMLElement).addEventListener("click", (e: Event) => { e.stopPropagation(); openConversation(lead); });

    // Temperatura do lead (define a cor/borda do card = ranqueamento visual).
    const t = leadTemperature(lead, nowMs);
    const card = h("div", {
      class: "floow-leaditem",
      style: `border-left:4px solid ${t.color}; background:${t.color}14; cursor:pointer;`,
    }, [
      h("div", { class: "floow-leaditem-main" }, [
        h("span", { class: "floow-leaditem-name" }, [(lead.prioridade ? "⭐ " : "") + (lead.empresa || lead.nome || "—")]),
        h("span", { class: "floow-leaditem-sub" }, [
          h("span", { style: `color:${t.color};font-weight:700`, title: `entrou no CRM há ${t.days < 1 ? "menos de 1 dia" : Math.floor(t.days) + " dia(s)"}` }, [t.label]),
          "  ·  ver detalhes ›",
        ]),
      ]),
      touchDots(n, lead.status),
      waBtn,
    ]);
    card.addEventListener("click", () => openLeadDetail(lead));
    wrap.append(card);
  }
  body.append(h("div", { class: "floow-section" }, [wrap]));
}

// Abre a conversa do lead. Tenta SEM recarregar (busca interna do WhatsApp);
// só recarrega por URL se a busca falhar (fallback). Sem reload, a extensão e o
// funil ficam intactos → "voltar ao funil" é instantâneo.
async function openConversation(lead: Lead) {
  const digits = leadDigits(lead);
  if (!digits) { flash("Lead sem número real — não dá pra abrir a conversa."); return; }
  returnStage = lead.status; // pra "voltar ao funil"
  pinned = false;            // vamos abrir a conversa de verdade → sai do modo detalhes
  flash("Abrindo conversa…");
  const ok = await openWhatsAppChat(digits, lead.empresa || lead.nome || "");
  if (ok) {
    view = "lead";
    render();          // a extensão continua carregada; o chat watcher casa o lead
    return;
  }
  // Fallback: recarrega por URL (mais lento e reseta a extensão, mas garante abrir).
  flash("Abrindo pelo recarregamento…");
  try { await chrome.storage.local.set({ floow_nav_stage: lead.status }); } catch {}
  window.location.href = `https://web.whatsapp.com/send?phone=${digits}`;
}

function renderAuth() {
  const email = h("input", { type: "email", placeholder: "E-mail", class: "floow-input" }) as HTMLInputElement;
  const pass = h("input", { type: "password", placeholder: "Senha", class: "floow-input" }) as HTMLInputElement;
  const msg = h("div", { class: "floow-msg" });
  const btn = h("button", { class: "floow-btn floow-btn-primary" }, ["Entrar"]);
  btn.addEventListener("click", async () => {
    btn.textContent = "Entrando…";
    const { error } = await supabase.auth.signInWithPassword({ email: email.value.trim(), password: pass.value });
    if (error) { msg.textContent = "Login falhou: " + error.message; btn.textContent = "Entrar"; return; }
    await afterAuth();
  });
  body.append(
    h("div", { class: "floow-section" }, [
      h("div", { class: "floow-title" }, ["Entrar no floow CRM"]),
      email, pass, msg, btn,
      h("div", { class: "floow-hint" }, ["Use o mesmo login do app."]),
    ]),
  );
}

function renderSearch() {
  const input = h("input", { type: "text", placeholder: "Buscar lead por nome ou telefone…", class: "floow-input" }) as HTMLInputElement;
  const list = h("div", { class: "floow-list" });
  function update() {
    const q = input.value.trim().toLowerCase();
    const qd = normalizePhone(q);
    const res = leads.filter((l) =>
      !q ? false :
      (l.nome || "").toLowerCase().includes(q) ||
      (l.empresa || "").toLowerCase().includes(q) ||
      (qd && normalizePhone(l.telefone).includes(qd)),
    ).slice(0, 8);
    list.replaceChildren(
      ...res.map((l) =>
        h("button", { class: "floow-listitem", onclick: () => { currentLeadId = l.id; searchMode = false; pinned = true; view = "lead"; matchInfo = "escolhido na busca"; render(); } }, [
          h("span", { class: "floow-dot", style: `background:${STATUS_DOT[l.status]}` }),
          h("span", { class: "floow-listname" }, [l.empresa || l.nome]),
          h("span", { class: "floow-listtag" }, [STATUS_LABELS[l.status]]),
        ]),
      ),
    );
    if (!res.length && q) list.append(h("div", { class: "floow-hint" }, ["Nenhum lead encontrado."]));
  }
  input.addEventListener("input", update);
  body.append(
    h("div", { class: "floow-section" }, [
      h("div", { class: "floow-row" }, [
        h("div", { class: "floow-title" }, ["Buscar lead"]),
        h("button", { class: "floow-link", onclick: () => { searchMode = false; render(); } }, ["voltar"]),
      ]),
      input, list,
    ]),
  );
  setTimeout(() => input.focus(), 0);
}

// Barra de busca FIXA no cabeçalho (sempre visível quando logado). Dropdown de
// resultados por nome/empresa/telefone — busca de QUALQUER tela, sem trocar de modo.
// Ao escolher, abre o lead em modo "detalhe" (pinned) → mostra "Abrir conversa".
function buildSearchBar(): HTMLElement {
  const input = h("input", {
    type: "text",
    placeholder: "🔍 Buscar lead (nome, empresa ou telefone)…",
    class: "floow-input",
  }) as HTMLInputElement;
  const results = h("div", { id: "floow-search-results" });
  const wrap = h("div", { id: "floow-search", style: "display:none" }, [input, results]);

  const hide = () => { results.replaceChildren(); results.classList.remove("open"); };
  const run = () => {
    const q = input.value.trim().toLowerCase();
    const qd = normalizePhone(q);
    if (!q) { hide(); return; }
    const res = leads.filter((l) =>
      (l.nome || "").toLowerCase().includes(q) ||
      (l.empresa || "").toLowerCase().includes(q) ||
      (qd && normalizePhone(l.telefone).includes(qd)),
    ).slice(0, 10);
    if (!res.length) {
      results.replaceChildren(h("div", { class: "floow-hint", style: "padding:8px 10px" }, ["Nenhum lead encontrado."]));
    } else {
      results.replaceChildren(...res.map((l) =>
        h("button", { class: "floow-listitem", onclick: () => {
          currentLeadId = l.id; searchMode = false; pinned = true; view = "lead";
          matchInfo = "escolhido na busca"; input.value = ""; hide(); expandPanel(); render();
        } }, [
          h("span", { class: "floow-dot", style: `background:${STATUS_DOT[l.status]}` }),
          h("span", { class: "floow-listname" }, [l.empresa || l.nome || "—"]),
          h("span", { class: "floow-listtag" }, [STATUS_LABELS[l.status]]),
        ]),
      ));
    }
    results.classList.add("open");
  };

  input.addEventListener("input", run);
  input.addEventListener("focus", run);
  input.addEventListener("keydown", (e) => {
    if ((e as KeyboardEvent).key === "Escape") { input.value = ""; hide(); input.blur(); }
  });
  // Fecha o dropdown ao clicar fora da barra.
  document.addEventListener("pointerdown", (e) => {
    if (!wrap.contains(e.target as Node)) hide();
  });

  return wrap;
}

// Detecta sinais de que o HTML do WhatsApp mudou e quebrou as leituras da extensão.
// Só acusa quando há MOTIVO forte (conversa claramente aberta, mas não lemos nada) —
// pra não dar falso alarme quando é só "nenhuma conversa aberta".
function layoutWarnings(): string[] {
  const out: string[] = [];
  const main = document.querySelector("#main");
  const header = main?.querySelector("header");
  // Conversa aberta (tem #main + header + mensagens), mas não lemos NEM número NEM nome.
  if (main && header) {
    const hasMsgs = !!main.querySelector("[data-id]");
    const phone = readActiveChatPhone();
    const title = readActiveChatTitle();
    if (hasMsgs && !phone && !title) {
      out.push("Não consegui ler a conversa aberta (nem número nem nome).");
    }
  }
  // Obs.: NÃO acusamos "quebra" só por não achar o botão de ligar. A ligação é
  // best-effort (o SDR pode clicar no botão do próprio WhatsApp) e ler/mover leads
  // continua funcionando — o alarme vermelho só vale pra quando a leitura falha.
  return out;
}

// Banner vermelho de "possível quebra" + botão pra copiar o diagnóstico pro Rafe.
function renderHealthBanner(): Node {
  const warns = layoutWarnings();
  if (warns.length === 0) return document.createTextNode("");

  const diag =
    `floow CRM — possível quebra da extensão\n` +
    `quando: ${new Date().toLocaleString("pt-BR")}\n` +
    `url: ${location.href}\n` +
    `problemas: ${warns.join(" | ")}\n` +
    `debug: tel=${readActiveChatPhone() ?? "—"} · nome=${readActiveChatTitle() ?? "—"} · main=${!!document.querySelector("#main")}`;

  const copy = h("button", { class: "floow-link" }, ["copiar diagnóstico"]);
  copy.addEventListener("click", async () => {
    try { await navigator.clipboard.writeText(diag); copy.textContent = "copiado ✓"; }
    catch { copy.textContent = "copie o print"; }
  });

  return h("div", { class: "floow-alert" }, [
    h("div", { class: "floow-alert-title" }, ["⚠️ A extensão pode ter quebrado"]),
    h("div", { class: "floow-alert-body" }, [
      "O WhatsApp parece ter mudado o layout. Avise o Rafe pra consertar:",
      h("ul", { class: "floow-alert-list" }, warns.map((w) => h("li", {}, [w]))),
    ]),
    copy,
  ]);
}

// Banner do motivo da etapa (desqualificado / perdido / carteira). Vazio se não houver.
function motivoBanner(lead: Lead): Node {
  const m = motivoDaEtapa(lead);
  if (!m) return document.createTextNode("");
  return h("div", {
    style: "margin:6px 0;padding:6px 8px;border:1px solid #f59e0b40;background:#f59e0b18;border-radius:6px;",
  }, [
    h("div", { style: "font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.04em;color:#f59e0bcc" }, [m.titulo]),
    h("div", { style: "font-size:12px;font-weight:600;color:#fde68a;margin-top:1px" }, [m.texto]),
  ]);
}

// Código do criativo que trouxe o lead (texto alfanumérico tem prioridade; senão o
// numérico). É a atribuição LAST-TOUCH: o webhook sempre grava o último anúncio que
// trouxe o lead, então aqui é só exibir o que está salvo.
function creativeCode(lead: Lead): string | null {
  if (lead.criativo_codigo_txt && lead.criativo_codigo_txt.trim()) return lead.criativo_codigo_txt.trim();
  if (lead.criativo_codigo != null) return String(lead.criativo_codigo);
  return null;
}

function renderLead() {
  const lead = currentLead();

  // Aviso de possível quebra (layout do WhatsApp mudou) — no topo, bem visível.
  body.append(renderHealthBanner());

  // Navegação (funil de vendas).
  body.append(renderNav());

  // Voltar pra lista da etapa que estava navegando (após abrir a conversa).
  if (returnStage) {
    const rs = returnStage;
    const b = h("button", { class: "floow-back-funnel" }, [`← Voltar ao funil · ${STATUS_LABELS[rs]}`]);
    b.addEventListener("click", () => { pinned = false; stageFilter = rs; view = "stage"; render(); });
    body.append(h("div", { class: "floow-section" }, [b]));
  }

  body.append(
    h("div", { class: "floow-section" }, [
      h("div", { class: "floow-row" }, [
        h("div", { class: "floow-chat" }, [
          lastTitle ? `Conversa: ${lastTitle}` : "Abra uma conversa",
          lastPhone ? ` · ${lastPhone}` : "",
        ]),
        h("div", { class: "floow-who" }, [
          h("button", { class: "floow-link", onclick: () => beginCreate() }, ["+ novo"]),
          h("button", { class: "floow-link", onclick: () => { searchMode = true; render(); } }, ["buscar"]),
        ]),
      ]),
    ]),
  );

  if (!lead) {
    const dbg = readChatDebug();
    body.append(
      h("div", { class: "floow-section floow-empty" }, [
        h("div", { class: "floow-hint" }, ["Nenhum lead vinculado a esta conversa."]),
        h("button", { class: "floow-btn floow-btn-primary", style: "margin-bottom:6px", onclick: () => beginCreate() }, ["+ Novo lead"]),
        h("button", { class: "floow-btn", onclick: () => { searchMode = true; render(); } }, ["Buscar lead manualmente"]),
        h("div", { class: "floow-debug" }, [
          `detectado → tel: ${dbg.phone ?? "—"} · nome: ${dbg.title ?? "—"}${dbg.mainFound ? "" : " · (conversa não detectada)"}`,
        ]),
      ]),
    );
    renderFooter();
    return;
  }

  const fonte = origemLabel(lead); // canal real (ig→Instagram) com fallback na fonte
  const editable = canEditLead(lead); // trava edição se o lead for de outra pessoa
  // Se está fixado (aberto pelo funil) mas a conversa desse lead já está aberta,
  // solta o pin e segue o fluxo normal (com ligar/áudio). Senão, modo "detalhes".
  if (pinned && chatMatchesLead(lead)) pinned = false;
  const pinnedDetail = pinned; // detalhes sem a conversa aberta
  // Número discável pro whatsapp:// (leads @lid não têm número real → sem botão).
  const waDigits = (() => {
    if (!lead.telefone || lead.telefone.includes("@lid")) return null;
    let d = lead.telefone.replace(/\D/g, "");
    if (!d) return null;
    if (d.length <= 11) d = "55" + d.replace(/^55/, "");
    return d;
  })();
  // Botão "Ligar pelo WhatsApp": tenta iniciar a chamada de voz no WhatsApp Web;
  // se não achar o botão nativo, abre o app desktop (fallback). Em qualquer caso,
  // ao terminar pergunta o resultado e REGISTRA no histórico do lead.
  let waButton: Node = document.createTextNode("");
  let recToggle: Node = document.createTextNode("");
  let importBtn: Node = document.createTextNode("");

  // Vincular contato SALVO (@lid): lead aberto manualmente (busca/funil) + conversa
  // aberta que NÃO casa (o WhatsApp trocou o telefone por @lid ao salvar o contato).
  // Grava o @lid no lead → casa automático nas próximas vezes.
  let linkBtn: Node = document.createTextNode("");
  if (pinned && editable) {
    const openId = readActiveChatPhone() || "";
    const openTitle = readActiveChatTitle() || "";
    if ((openId || openTitle) && !chatMatchesLead(lead)) {
      const b = h("button", {
        class: "floow-btn",
        style: "background:#3a2a10;color:#f5c518;border:1px solid #f5c51855;margin-top:6px",
        title: "Liga este contato (salvo) a este lead — passa a casar sozinho",
      }, ["📌 Vincular este contato ao lead"]);
      b.addEventListener("click", () => linkChatToLead(lead, openId, openTitle, b as HTMLButtonElement));
      linkBtn = b;
    }
  }
  if (waDigits && pinnedDetail) {
    // Detalhes sem a conversa aberta → botão pra ABRIR a conversa (aí liga/áudio).
    const btn = h("button", { class: "floow-btn floow-wa", title: "Abre a conversa do lead no WhatsApp" }, ["💬 Abrir conversa no WhatsApp"]);
    btn.addEventListener("click", () => openConversation(lead));
    waButton = btn;
  } else if (waDigits && editable) {
    const btn = h("button", {
      class: "floow-btn floow-wa",
      title: "Liga pelo WhatsApp e registra no histórico",
    });
    btn.innerHTML =
      '<svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">' +
      '<path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z"/></svg>' +
      "<span>📞 Ligar pelo WhatsApp</span>";
    btn.addEventListener("click", () => handleCall(lead, waDigits));
    waButton = btn;

    // Interruptor "Gravar ligação" — LIGA/DESLIGA é decisão do ADMIN. O SDR só vê o
    // estado (bloqueado). O admin pode alterar o próprio estado aqui.
    const on = member.recordCalls;
    const locked = !member.isAdmin;
    const sw = h("button", {
      class: "floow-recsw" + (on ? " on" : "") + (locked ? " locked" : ""),
      title: locked
        ? "Definido pelo admin (Configurações → Usuários). SDR não altera."
        : "Liga/desliga a gravação automática das suas ligações",
    }, [
      h("span", { class: "floow-recsw-track" }, [h("span", { class: "floow-recsw-knob" })]),
      h("span", {}, [`${on ? "🔴" : "⚪"} Gravar ligação: ${on ? "ligado" : "desligado"}${locked ? " 🔒" : ""}`]),
    ]);
    sw.addEventListener("click", () => {
      if (locked) { flash("Só o admin altera a gravação (Configurações → Usuários)."); return; }
      setRecordCallsAdmin(!member.recordCalls);
    });
    recToggle = sw;
  }

  // Importar histórico da conversa ABERTA pro CRM (raspa o DOM do WhatsApp Web).
  // É o único jeito de trazer mensagens ANTIGAS — o Z-API não devolve histórico no
  // multi-dispositivo. Captura só texto; rola pra cima pra pegar o histórico geral.
  // Aparece sempre que a conversa está aberta (mesmo lead de outro SDR — é só leitura).
  if (waDigits && !pinnedDetail) {
    const imp = h("button", {
      class: "floow-btn",
      style: "background:#1f2733;color:#cbd5e1;margin-top:6px",
      title: "Puxa TODO o histórico (rola pra cima). O recente já entra sozinho ao abrir a conversa.",
    }, ["📥 Importar histórico completo"]);
    imp.addEventListener("click", () => importHistory(lead, waDigits, imp as HTMLButtonElement));
    importBtn = imp;

    // Auto-import SILENCIOSO do trecho já carregado (1x por lead/sessão). Sem rolar a
    // tela, sem aviso — só espelha o recente conforme você abre as conversas.
    if (!autoImported.has(lead.id)) {
      autoImported.add(lead.id);
      autoImportHistory(lead, waDigits);
    }
  }

  // Botão "Ligar (telefone)" via API4COM (webphone embutido na extensão). Aparece
  // sempre que há um número — a ligação não depende da conversa estar aberta.
  let tsPhone: Node = document.createTextNode("");
  if (waDigits) {
    mountWebphoneWidget();
    tsPhone = buildApi4comCallButton(lead);
  }

  // Histórico de ligações (contador + última) — preenchido em seguida (async).
  const callInfo = h("div", { class: "floow-callinfo" }, ["📞 carregando histórico…"]);
  refreshCallHistory(lead.id, callInfo);

  // Instagram do lead (ícone + @) → abre o perfil numa aba nova.
  let igLink: Node = document.createTextNode("");
  if (lead.instagram) {
    const handle = lead.instagram.replace(/^@/, "");
    const a = h("a", {
      class: "floow-ig",
      href: `https://instagram.com/${handle}`,
      target: "_blank",
      rel: "noopener",
      title: `@${handle} no Instagram`,
    });
    a.innerHTML =
      '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">' +
      '<rect x="2" y="2" width="20" height="20" rx="5"/><circle cx="12" cy="12" r="4"/>' +
      '<circle cx="17.5" cy="6.5" r="1.2" fill="currentColor" stroke="none"/></svg>' +
      `<span>@${handle}</span>`;
    igLink = a;
  }

  // Linha do SDR: admin troca por um seletor; os demais só veem o nome.
  const sdrRow: Node = member.isAdmin
    ? buildSdrSelect(lead)
    : (lead.sdr_responsavel ? h("div", {}, [`SDR: ${lead.sdr_responsavel}`]) : document.createTextNode(""));

  // Linha do Closer: admin escolhe quem fecha (Rafê × Allan) em TODOS os leads;
  // os demais só veem o nome.
  const closerRow: Node = member.isAdmin
    ? buildCloserSelect(lead)
    : (lead.closer_responsavel ? h("div", {}, [`Closer: ${lead.closer_responsavel}`]) : document.createTextNode(""));

  const lockBanner: Node = !editable
    ? h("div", { class: "floow-lock" }, [`🔒 Lead de ${lead.sdr_responsavel || "outro responsável"} — somente leitura`])
    : document.createTextNode("");

  // Botão de editar as infos do lead (sem precisar abrir o CRM).
  let editBtn: Node = document.createTextNode("");
  if (editable) {
    const b = h("button", { class: "floow-link", title: "Editar informações do lead" }, ["✏️ Editar"]);
    b.addEventListener("click", async () => {
      const patch = await editLeadModal(lead);
      if (patch) { Object.assign(lead, patch); flash("Informações salvas ✓"); render(); }
    });
    editBtn = b;
  }

  // Estrela de prioridade (manual) — sobe o lead pro topo da coluna no funil/CRM.
  const prioStar = h("button", {
    title: lead.prioridade ? "Remover prioridade — tira do topo" : "Marcar como prioridade — sobe pro topo da coluna",
    style: `background:none;border:none;cursor:pointer;font-size:17px;line-height:1;padding:0 2px;color:${lead.prioridade ? "#f5c518" : "#8a8f98"}`,
  }, [lead.prioridade ? "⭐" : "☆"]) as HTMLButtonElement;
  prioStar.addEventListener("click", async () => {
    const next = !lead.prioridade;
    prioStar.textContent = next ? "⭐" : "☆";
    prioStar.style.color = next ? "#f5c518" : "#8a8f98";
    const { error } = await supabase.from("leads").update({ prioridade: next }).eq("id", lead.id);
    if (error) {
      prioStar.textContent = lead.prioridade ? "⭐" : "☆";
      flash("Erro ao priorizar: " + error.message);
      return;
    }
    lead.prioridade = next;
    flash(next ? "Marcado como prioridade ⭐" : "Prioridade removida");
    render();
  });

  body.append(
    h("div", { class: "floow-section" }, [
      h("div", { class: "floow-row" }, [
        prioStar,
        h("div", { class: "floow-leadname" }, [lead.empresa || lead.nome]),
        editBtn,
      ]),
      lead.empresa ? h("div", { class: "floow-leadsub" }, [lead.nome]) : document.createTextNode(""),
      h("div", { style: "display:flex;gap:6px;flex-wrap:wrap;align-items:center" }, [
        h("div", { class: "floow-badge", style: `border-color:${STATUS_DOT[lead.status]}55;color:${STATUS_DOT[lead.status]}` }, [
          h("span", { class: "floow-dot", style: `background:${STATUS_DOT[lead.status]}` }), STATUS_LABELS[lead.status],
        ]),
        (() => {
          const t = leadTemperature(lead, Date.now());
          return h("div", { class: "floow-badge", style: `border-color:${t.color}55;color:${t.color}`, title: `entrou no CRM há ${t.days < 1 ? "menos de 1 dia" : Math.floor(t.days) + " dia(s)"}` }, [t.label]);
        })(),
      ]),
      motivoBanner(lead),
      lockBanner,
      h("div", { class: "floow-meta" }, [
        sdrRow,
        closerRow,
        fonte ? h("div", {}, [`Origem: ${fonte}`]) : document.createTextNode(""),
        creativeCode(lead) ? h("div", { style: "color:#f5c518" }, [`🎬 Criativo: ${creativeCodeClean(creativeCode(lead))}`]) : document.createTextNode(""),
        lead.cidade ? h("div", {}, [`📍 ${lead.cidade}${lead.estado ? " · " + lead.estado : ""}`]) : document.createTextNode(""),
        lead.data_agendamento ? h("div", { style: "color:#f5c518" }, [`📅 ${fmtDate(lead.data_agendamento)}`]) : document.createTextNode(""),
      ]),
      igLink,
      matchInfo ? h("div", { class: "floow-hint" }, [`vinculado ${matchInfo}`]) : document.createTextNode(""),
      linkBtn,
      waButton,
      tsPhone,
      recToggle,
      importBtn,
      callInfo,
    ]),
  );

  // Áudios prontos (biblioteca) — só com a conversa aberta (não no modo detalhes).
  if (waDigits && editable && !pinnedDetail && audios.length > 0) {
    const wrap = h("div", { class: "floow-pills" });
    for (const a of audios) {
      const btn = h("button", { class: "floow-audio" }, [`${a.emoji ? a.emoji + " " : "🎤 "}${a.name}`]);
      btn.addEventListener("click", () => sendAudio(a, waDigits, btn));
      wrap.append(btn);
    }
    body.append(h("div", { class: "floow-section" }, [
      h("div", { class: "floow-title" }, ["Enviar áudio"]),
      wrap,
    ]));
  }

  // Mensagens prontas — abaixo dos áudios. Sem vídeo → COPIA o texto; com vídeo
  // → ENVIA o vídeo pro lead (precisa da conversa aberta + permissão).
  if (!pinnedDetail && cannedMsgs.length > 0) {
    const canSend = !!waDigits && editable;
    const wrap = h("div", { class: "floow-pills" });
    let shown = 0;
    for (const m of cannedMsgs) {
      if (m.video_url) {
        // Vídeo → envia. Só aparece com a conversa aberta (precisa do número).
        if (!canSend) continue;
        const btn = h("button", { class: "floow-audio", title: "Enviar vídeo" }, [`🎬 ${m.title}`]);
        btn.addEventListener("click", () => sendCannedVideo(m, waDigits, btn));
        wrap.append(btn); shown++;
      } else {
        // Texto → copia.
        const btn = h("button", { class: "floow-audio", title: "Copiar mensagem" }, [`📋 ${m.title}`]);
        btn.addEventListener("click", async () => {
          try {
            await navigator.clipboard.writeText(m.content ?? "");
            const orig = btn.textContent;
            btn.textContent = "✓ Copiado";
            setTimeout(() => { btn.textContent = orig; }, 1400);
            flash("Mensagem copiada ✓");
          } catch {
            flash("Não consegui copiar — copie manualmente.");
          }
        });
        wrap.append(btn); shown++;
      }
    }
    if (shown > 0) {
      body.append(h("div", { class: "floow-section" }, [
        h("div", { class: "floow-title" }, ["Mensagens prontas"]),
        wrap,
      ]));
    }
  }

  // Mover etapa — TODAS as etapas, com trava por papel + regras (dialogs).
  const grid = h("div", { class: "floow-grid" });
  for (const s of STATUS_ORDER) {
    const active = s === lead.status;
    const allowed = active || (editable && canMoveTo(s, member));
    const b = h("button", {
      class: `floow-stage${active ? " active" : ""}${!allowed ? " locked" : ""}`,
      style: active ? `border-color:${STATUS_DOT[s]}55;color:${STATUS_DOT[s]}` : "",
      title: !editable ? "Lead de outro responsável — só leitura" : (!allowed ? "Etapa do Closer — sem permissão" : ""),
    }, [h("span", { class: "floow-dot", style: `background:${STATUS_DOT[s]}` }), STATUS_LABELS[s]]);
    if (!active && allowed) b.addEventListener("click", () => beginMove(lead, s));
    grid.append(b);
  }
  body.append(h("div", { class: "floow-section" }, [h("div", { class: "floow-title" }, ["Mover para"]), grid]));

  // Tarefas (lista de pendentes + criar) — igual ao CRM.
  body.append(renderTaskSection(lead, editable));

  // Observações
  const ta = h("textarea", { class: "floow-input floow-textarea", placeholder: "Observações…" }) as HTMLTextAreaElement;
  ta.value = lead.observacoes ?? "";
  if (!editable) ta.setAttribute("readonly", "true");
  const saveBtn = h("button", { class: "floow-btn floow-btn-primary", disabled: "true" }, ["Salvar observações"]) as HTMLButtonElement;
  ta.addEventListener("input", () => { saveBtn.disabled = ta.value === (lead.observacoes ?? ""); });
  saveBtn.addEventListener("click", async () => {
    saveBtn.textContent = "Salvando…";
    const novo = ta.value.trim() || null;
    const { error } = await supabase.from("leads").update({ observacoes: novo }).eq("id", lead.id);
    saveBtn.textContent = "Salvar observações";
    if (error) { flash("Erro ao salvar: " + error.message); return; }
    lead.observacoes = novo;
    saveBtn.disabled = true;
    await supabase.from("lead_events").insert({
      lead_id: lead.id, tipo: "note", actor_email: sessionEmail, actor_name: member.name,
      payload: { via: "whatsapp_ext", note: "Observações atualizadas pela extensão" },
    });
    flash("Observações salvas ✓");
  });
  body.append(h("div", { class: "floow-section" }, [h("div", { class: "floow-title" }, ["Observações"]), ta, editable ? saveBtn : document.createTextNode("")]));

  // Jornada no funil (histórico de etapas do lead).
  const journey = h("div", { class: "floow-journey" }, [h("div", { class: "floow-hint" }, ["carregando…"])]);
  renderJourney(lead.id, journey);
  body.append(h("div", { class: "floow-section" }, [h("div", { class: "floow-title" }, ["Jornada no funil"]), journey]));

  renderFooter(lead);
}

// Seletor de SDR responsável (só admin) — troca o dono do lead.
function buildSdrSelect(lead: Lead): Node {
  const sel = h("select", { class: "floow-sdrsel" }) as HTMLSelectElement;
  sel.append(h("option", { value: "" }, ["SDR: (nenhum)"]));
  for (const s of sdrs) {
    const o = h("option", { value: s.name }, [`SDR: ${s.name}`]);
    if (lead.sdr_responsavel === s.name) o.setAttribute("selected", "true");
    sel.append(o);
  }
  // Garante a opção do SDR atual mesmo que não esteja na lista de ativos.
  if (lead.sdr_responsavel && !sdrs.some((s) => s.name === lead.sdr_responsavel)) {
    const o = h("option", { value: lead.sdr_responsavel }, [`SDR: ${lead.sdr_responsavel}`]);
    o.setAttribute("selected", "true");
    sel.append(o);
  }
  sel.addEventListener("change", async () => {
    const novo = sel.value || null;
    const { error } = await supabase.from("leads").update({ sdr_responsavel: novo }).eq("id", lead.id);
    if (error) { flash("Erro ao trocar SDR: " + error.message); return; }
    lead.sdr_responsavel = novo;
    flash(`SDR responsável: ${novo ?? "nenhum"} ✓`);
  });
  return sel;
}

// Seletor de Closer responsável (só admin) — quem vai conduzir/fechar o lead.
// Vale pra TODOS os leads (ex.: Rafê × Allan). Define quem o lead "pertence" na
// zona do Closer e, consequentemente, pra quem ele aparece na extensão.
function buildCloserSelect(lead: Lead): Node {
  const sel = h("select", { class: "floow-sdrsel" }) as HTMLSelectElement;
  sel.append(h("option", { value: "" }, ["Closer: (nenhum)"]));
  for (const c of closers) {
    const o = h("option", { value: c.name }, [`Closer: ${c.name}`]);
    if (lead.closer_responsavel === c.name) o.setAttribute("selected", "true");
    sel.append(o);
  }
  // Garante a opção do Closer atual mesmo que não esteja na lista de ativos.
  if (lead.closer_responsavel && !closers.some((c) => c.name === lead.closer_responsavel)) {
    const o = h("option", { value: lead.closer_responsavel }, [`Closer: ${lead.closer_responsavel}`]);
    o.setAttribute("selected", "true");
    sel.append(o);
  }
  sel.addEventListener("change", async () => {
    const novo = sel.value || null;
    const { error } = await supabase.from("leads").update({ closer_responsavel: novo }).eq("id", lead.id);
    if (error) { flash("Erro ao trocar Closer: " + error.message); return; }
    lead.closer_responsavel = novo;
    flash(`Closer responsável: ${novo ?? "nenhum"} ✓`);
    render();
  });
  return sel;
}

// Seção de tarefas do lead: lista os pendentes + formulário pra criar uma nova.
function renderTaskSection(lead: Lead, editable: boolean): Node {
  const sec = h("div", { class: "floow-section" });
  sec.append(h("div", { class: "floow-title" }, ["Tarefas"]));

  const listNode = h("div", { class: "floow-tasklist" }, [h("div", { class: "floow-hint" }, ["carregando…"])]);
  refreshTasks(lead, listNode, editable);
  sec.append(listNode);

  if (!editable) return sec; // lead de outra pessoa → só lista, sem criar

  let tipo = "outro";
  const titulo = h("input", { class: "floow-input", placeholder: "Título da tarefa" }) as HTMLInputElement;
  const due = h("input", { class: "floow-input", type: "datetime-local", style: "color-scheme:dark" }) as HTMLInputElement;

  // Seletor de tipo (pills) — auto-preenche título e prazo sugerido.
  const pills = h("div", { class: "floow-pills", style: "margin-bottom:8px" });
  const paint = () => pills.querySelectorAll(".floow-pill").forEach((el) => {
    const on = (el as HTMLElement).dataset.tipo === tipo;
    (el as HTMLElement).style.cssText = on
      ? `border-color:${TASK_TIPO_COLORS[tipo]}88;background:${TASK_TIPO_COLORS[tipo]}22;color:${TASK_TIPO_COLORS[tipo]}`
      : "";
  });
  for (const tp of TASK_TIPO_OPTIONS) {
    const b = h("button", { class: "floow-pill", "data-tipo": tp }, [`${TASK_TIPO_ICONS[tp]} ${TASK_TIPO_LABELS[tp]}`]);
    b.addEventListener("click", () => {
      if (!titulo.value.trim() || titulo.value === taskTitleFor(tipo, lead)) titulo.value = taskTitleFor(tp, lead);
      const sug = suggestedTaskDue(tp, lead);
      if (sug && !due.value) due.value = toLocalInput(sug);
      tipo = tp; paint();
    });
    pills.append(b);
  }

  const descricao = h("textarea", { class: "floow-input floow-textarea", placeholder: "Descrição (opcional)" }) as HTMLTextAreaElement;
  const assignee = assigneeSelect(member.name);
  const recorrente = recorrenteCheck();

  const btn = h("button", { class: "floow-btn floow-btn-primary" }, ["Criar tarefa"]) as HTMLButtonElement;
  btn.addEventListener("click", async () => {
    const t = titulo.value.trim();
    if (!t) { flash("Digite o título da tarefa."); return; }
    if (!due.value) { flash("Defina o prazo da tarefa."); return; }
    btn.disabled = true; btn.textContent = "Criando…";
    const { error } = await supabase.from("tasks").insert({
      lead_id: lead.id, titulo: t, descricao: descricao.value.trim() || null, due_at: new Date(due.value).toISOString(),
      assignee: assignee.value, notify: true, tipo, created_by: member.name,
      recorrente: recorrente.input.checked,
    });
    btn.disabled = false; btn.textContent = "Criar tarefa";
    if (error) { flash("Erro ao criar tarefa: " + error.message); return; }
    flash("Tarefa criada ✓");
    titulo.value = ""; descricao.value = ""; due.value = ""; tipo = "outro"; recorrente.input.checked = false; paint();
    refreshTasks(lead, listNode);
  });
  sec.append(pills, titulo, descricao, due, h("div", { class: "floow-qlabel" }, ["Responsável"]), assignee, recorrente.label, btn);
  return sec;
}

// Checkbox "🔁 Recorrente" reutilizável.
function recorrenteCheck(checked = false): { input: HTMLInputElement; label: HTMLElement } {
  const input = h("input", { type: "checkbox" }) as HTMLInputElement;
  input.checked = checked;
  const label = h("label", { style: "display:flex;align-items:flex-start;gap:6px;font-size:12px;color:#d4d4d8;margin:6px 0;cursor:pointer" }, [
    input, h("span", {}, ["🔁 ", h("b", {}, ["Recorrente"]), " — ao concluir, recria pro dia seguinte no mesmo horário (follow-up até o cliente responder)"]),
  ]);
  return { input, label };
}

// Conclui uma tarefa; se recorrente e `recriar`, recria pro dia seguinte mesmo horário.
async function completeTaskExt(t: { id: string; titulo: string; descricao?: string | null; due_at: string | null; tipo: string; assignee?: string | null; lead_id?: string | null; recorrente?: boolean }, recriar: boolean | { hojeIso: string }) {
  await supabase.from("tasks").update({ done: true }).eq("id", t.id);
  if (!t.recorrente || !t.lead_id) return;

  let dueIso: string | null = null;
  if (recriar === true) {
    const base = t.due_at ? new Date(t.due_at) : new Date();
    const next = new Date(); next.setDate(next.getDate() + 1); next.setHours(base.getHours(), base.getMinutes(), 0, 0);
    dueIso = next.toISOString();
  } else if (typeof recriar === "object" && recriar.hojeIso) {
    dueIso = recriar.hojeIso;
  }
  if (!dueIso) return;

  await supabase.from("tasks").insert({
    lead_id: t.lead_id, titulo: t.titulo, descricao: t.descricao ?? null, due_at: dueIso,
    assignee: t.assignee ?? null, notify: true, tipo: t.tipo, recorrente: true, created_by: member.name,
  });
}

// Ao concluir tarefa recorrente: pergunta recriar amanhã ou encerrar. Devolve o que fazer.
type RecorrenteChoice = "recria" | "encerra" | { hojeIso: string };
function askRecorrenteDone(): Promise<RecorrenteChoice | null> {
  return openModal<RecorrenteChoice>("🔁 Tarefa recorrente", (api) => {
    const wrap = h("div", {});
    const p2 = (n: number) => String(n).padStart(2, "0");

    const renderMain = () => {
      wrap.replaceChildren();
      const b1 = h("button", { class: "floow-btn floow-btn-primary", style: "width:100%;text-align:left" }, ["✓ Feito — recria amanhã no mesmo horário"]);
      b1.addEventListener("click", () => api.done("recria"));
      const bMid = h("button", { class: "floow-btn", style: "width:100%;text-align:left;margin-top:6px;border-color:#f5c51866;color:#f5c518" }, ["✓ Feito — recria hoje em outro horário"]);
      bMid.addEventListener("click", () => renderPick());
      const bDia = h("button", { class: "floow-btn", style: "width:100%;text-align:left;margin-top:6px;border-color:#f5c51866;color:#f5c518" }, ["✓ Feito — recriar em outro dia e horário"]);
      bDia.addEventListener("click", () => renderPickDay());
      const b2 = h("button", { class: "floow-btn", style: "width:100%;text-align:left;margin-top:6px" }, ["✓ Feito e encerrar (não recria)"]);
      b2.addEventListener("click", () => api.done("encerra"));
      wrap.append(h("div", { class: "floow-hint", style: "margin-bottom:8px" }, ["Como quer concluir?"]), b1, bMid, bDia, b2);
    };

    const renderPick = () => {
      wrap.replaceChildren();
      const plus3 = new Date(Date.now() + 3 * 60 * 60 * 1000);
      const timeIn = h("input", { type: "time", class: "floow-input", value: `${p2(plus3.getHours())}:${p2(plus3.getMinutes())}` }) as HTMLInputElement;
      const back = h("button", { class: "floow-btn", style: "margin-top:8px" }, ["← Voltar"]);
      back.addEventListener("click", () => renderMain());
      const ok = h("button", { class: "floow-btn floow-btn-primary", style: "width:100%;text-align:center;margin-top:6px" }, ["Recriar hoje nesse horário"]);
      ok.addEventListener("click", () => {
        const v = timeIn.value; if (!v) return;
        const [hh, mm] = v.split(":").map(Number);
        const due = new Date(); due.setHours(hh, mm, 0, 0);
        if (due.getTime() <= Date.now()) due.setDate(due.getDate() + 1); // garante futuro
        api.done({ hojeIso: due.toISOString() });
      });
      wrap.append(
        h("div", { class: "floow-hint", style: "margin-bottom:6px" }, ["Recria hoje às (já 3h à frente):"]),
        timeIn, ok, back,
      );
    };

    // Sub-tela: escolher DIA + HORA (recria a mesma tarefa na data/hora escolhida).
    const renderPickDay = () => {
      wrap.replaceChildren();
      const amanha = new Date(Date.now() + 24 * 60 * 60 * 1000);
      const dtIn = h("input", { type: "datetime-local", class: "floow-input", value: toLocalInput(amanha.toISOString()) }) as HTMLInputElement;
      const ok = h("button", { class: "floow-btn floow-btn-primary", style: "width:100%;text-align:center;margin-top:6px" }, ["Recriar nessa data e hora"]);
      ok.addEventListener("click", () => {
        const v = dtIn.value; if (!v) return;
        const due = new Date(v); // datetime-local = hora local
        if (isNaN(due.getTime())) return;
        api.done({ hojeIso: due.toISOString() });
      });
      const back = h("button", { class: "floow-btn", style: "margin-top:8px" }, ["← Voltar"]);
      back.addEventListener("click", () => renderMain());
      wrap.append(
        h("div", { class: "floow-hint", style: "margin-bottom:6px" }, ["Escolha o novo dia e horário (mesma tarefa):"]),
        dtIn, ok, back,
      );
    };

    renderMain();
    return wrap;
  });
}

// Wrapper: conclui pedindo escolha se for recorrente. Devolve true se concluiu.
async function concluirTarefa(t: { id: string; titulo: string; descricao?: string | null; due_at: string | null; tipo: string; assignee?: string | null; lead_id?: string | null; recorrente?: boolean }): Promise<boolean> {
  if (t.recorrente) {
    const c = await askRecorrenteDone();
    if (!c) return false;
    await completeTaskExt(t, c === "recria" ? true : c === "encerra" ? false : c);
  } else {
    await completeTaskExt(t, false);
  }
  return true;
}

// ISO → valor do input datetime-local (respeita o fuso local).
function toLocalInput(iso: string): string {
  const d = new Date(iso); const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

async function refreshTasks(lead: Lead, node: HTMLElement, editable = true) {
  const { data } = await supabase
    .from("tasks")
    .select("id,titulo,descricao,due_at,done,tipo,assignee,lead_id,recorrente")
    .eq("lead_id", lead.id)
    .eq("done", false)
    .order("due_at", { ascending: true, nullsFirst: false });
  node.replaceChildren();
  const rows = (data ?? []) as { id: string; titulo: string; descricao: string | null; due_at: string | null; tipo: string; assignee: string | null; lead_id: string | null; recorrente: boolean }[];
  if (rows.length === 0) { node.append(h("div", { class: "floow-hint", style: "margin:0 0 8px" }, ["Nenhuma tarefa pendente."])); return; }
  const fmt = (iso: string) => {
    const d = new Date(iso); const p = (n: number) => String(n).padStart(2, "0");
    return `${p(d.getDate())}/${p(d.getMonth() + 1)} ${p(d.getHours())}:${p(d.getMinutes())}`;
  };
  for (const t of rows) {
    const check = editable
      ? h("button", { class: "floow-task-check", title: "Concluir" }, ["○"])
      : h("span", { class: "floow-task-check", style: "cursor:default" }, ["○"]);
    if (editable) check.addEventListener("click", async (e: Event) => {
      e.stopPropagation();
      check.textContent = "…";
      const ok = await concluirTarefa(t);
      if (ok) refreshTasks(lead, node, editable); else check.textContent = "○";
    });
    const title = h("span", { class: "floow-task-title", style: editable ? "cursor:pointer" : "", title: editable ? "Editar / copiar mensagens" : "" }, [`${t.recorrente ? "🔁 " : ""}${t.titulo}`]);
    if (editable) title.addEventListener("click", () => { editTaskModal(t, lead).then(() => refreshTasks(lead, node, editable)); });
    node.append(h("div", { class: "floow-task-row" }, [
      check,
      title,
      t.due_at ? h("span", { class: "floow-task-due" }, [fmt(t.due_at)]) : document.createTextNode(""),
    ]));
  }
}

// Histórico de etapas do lead (created + status_change), do mais antigo ao recente.
async function renderJourney(leadId: string, node: HTMLElement) {
  const { data, error } = await supabase
    .from("lead_events")
    .select("tipo, from_status, to_status, created_at")
    .eq("lead_id", leadId)
    .in("tipo", ["created", "status_change"])
    .order("created_at", { ascending: true });
  node.replaceChildren();
  if (error) return;
  const rows = (data ?? []) as { tipo: string; to_status: LeadStatus | null; created_at: string }[];
  if (rows.length === 0) { node.append(h("div", { class: "floow-hint" }, ["Sem histórico de etapas."])); return; }

  const fmt = (iso: string) => {
    const d = new Date(iso); const p = (n: number) => String(n).padStart(2, "0");
    return `${p(d.getDate())}/${p(d.getMonth() + 1)} ${p(d.getHours())}:${p(d.getMinutes())}`;
  };
  for (const ev of rows) {
    const st = ev.to_status;
    if (!st) continue;
    node.append(h("div", { class: "floow-journey-row" }, [
      h("span", { class: "floow-dot", style: `background:${STATUS_DOT[st]}` }),
      h("span", { class: "floow-journey-label" }, [
        ev.tipo === "created" ? `Entrou · ${STATUS_LABELS[st]}` : STATUS_LABELS[st],
      ]),
      h("span", { class: "floow-journey-date" }, [fmt(ev.created_at)]),
    ]));
  }
}

// Abre o CRM SEMPRE na MESMA janela/aba (nomeada "floow_crm") e traz ela pra
// frente. Reusa a janela existente em vez de abrir uma nova a cada clique.
function openCrm(e: Event, url: string) {
  e.preventDefault();
  const win = window.open(url, "floow_crm");
  win?.focus();
}

function renderFooter(lead?: Lead) {
  body.append(
    h("div", { class: "floow-section floow-footer" }, [
      lead
        ? h("a", { class: "floow-link", href: `${APP_URL}/kanban?lead=${lead.id}`, onclick: (e: Event) => openCrm(e, `${APP_URL}/kanban?lead=${lead.id}`) }, ["Abrir no app ↗"])
        : h("a", { class: "floow-link", href: `${APP_URL}/kanban`, onclick: (e: Event) => openCrm(e, `${APP_URL}/kanban`) }, ["Abrir app ↗"]),
      h("div", { class: "floow-who" }, [
        h("span", { class: "floow-hint" }, [member.name ? `Logado: ${member.name}` : (sessionEmail ?? "")]),
        h("button", { class: "floow-link", onclick: doLogout }, ["sair"]),
      ]),
    ]),
  );
}

function fmtDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

let flashTimer: ReturnType<typeof setTimeout> | null = null;
function flash(text: string) {
  let el = document.getElementById("floow-flash");
  if (!el) { el = h("div", { id: "floow-flash" }); panel.append(el); }
  el.textContent = text;
  el.classList.add("show");
  if (flashTimer) clearTimeout(flashTimer);
  flashTimer = setTimeout(() => el!.classList.remove("show"), 2200);
}

// ============================================================
// Modais (regras de cada etapa, como no app)
// ============================================================
type ModalApi<T> = { setError: (m: string) => void; done: (v: T) => void; cancel: () => void };

function openModal<T>(title: string, build: (api: ModalApi<T>) => HTMLElement): Promise<T | null> {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (v: T | null) => { if (settled) return; settled = true; overlay.remove(); resolve(v); };
    const errEl = h("div", { class: "floow-msg" });
    const api: ModalApi<T> = { setError: (m) => { errEl.textContent = m; }, done: (v) => finish(v), cancel: () => finish(null) };
    const bodyEl = build(api);
    const overlay = h("div", { class: "floow-modal" }, [
      h("div", { class: "floow-modal-card" }, [
        h("div", { class: "floow-modal-head" }, [
          h("div", { class: "floow-title" }, [title]),
          h("button", { class: "floow-x", onclick: () => api.cancel() }, ["×"]),
        ]),
        h("div", { class: "floow-modal-body" }, [bodyEl, errEl]),
      ]),
    ]);
    panel.append(overlay);
  });
}

function askQualification(lead: Lead): Promise<Record<string, string> | null> {
  const vals: Record<string, string> = {};
  for (const f of QUAL_FIELDS) { const v = lead[f.key] as string | null; if (v) vals[f.key as string] = v; }
  return openModal("Qualificação obrigatória", (api) => {
    const wrap = h("div", {});
    wrap.append(h("div", { class: "floow-hint", style: "margin-bottom:8px" }, ["Preencha pra avançar (igual ao app)."]));

    // Estado → cidade (agora pedidos na qualificação).
    const uf = h("select", { class: "floow-input" }) as HTMLSelectElement;
    uf.append(h("option", { value: "" }, ["Estado…"]));
    for (const u of ESTADO_OPTIONS) {
      const opt = h("option", { value: u }, [`${u} — ${UF_LABELS[u]}`]);
      if (lead.estado === u) opt.setAttribute("selected", "true");
      uf.append(opt);
    }
    const cidadeSel = h("select", { class: "floow-input" }) as HTMLSelectElement;
    const fillCidades = (estado: string, selected: string | null) => {
      cidadeSel.innerHTML = "";
      cidadeSel.append(h("option", { value: "" }, [estado ? "Cidade…" : "Escolha o estado primeiro"]));
      for (const c of cidadesForUf(estado)) {
        const opt = h("option", { value: c }, [c]);
        if (selected === c) opt.setAttribute("selected", "true");
        cidadeSel.append(opt);
      }
    };
    fillCidades(lead.estado || "", lead.cidade || null);
    uf.addEventListener("change", () => fillCidades(uf.value, null));
    wrap.append(h("div", { class: "floow-qlabel" }, ["Estado"]), uf, h("div", { class: "floow-qlabel" }, ["Cidade"]), cidadeSel);

    for (const f of QUAL_FIELDS) {
      const pills = h("div", { class: "floow-pills" });
      for (const [val, label] of Object.entries(f.options)) {
        const b = h("button", { class: "floow-pill" + (vals[f.key as string] === val ? " sel" : "") }, [label]);
        b.addEventListener("click", () => {
          vals[f.key as string] = val;
          pills.querySelectorAll(".floow-pill").forEach((x) => x.classList.remove("sel"));
          b.classList.add("sel");
        });
        pills.append(b);
      }
      wrap.append(h("div", { class: "floow-qlabel" }, [f.label]), pills);
    }

    const confirm = h("button", { class: "floow-btn floow-btn-primary", style: "margin-top:10px" }, ["Confirmar qualificação"]);
    confirm.addEventListener("click", () => {
      if (!uf.value || !cidadeSel.value) { api.setError("Selecione o estado e a cidade."); return; }
      for (const f of QUAL_FIELDS) if (!vals[f.key as string]) { api.setError("Falta: " + f.label); return; }
      api.done({ ...vals, estado: uf.value, cidade: cidadeSel.value });
    });
    wrap.append(confirm);
    return wrap;
  });
}

// Info do negócio (Pré qualificado): decisor, empresa, instagram, segmento.
function askBusinessInfo(lead: Lead): Promise<Record<string, string> | null> {
  return openModal("Informações do negócio", (api) => {
    const wrap = h("div", {});
    wrap.append(h("div", { class: "floow-hint", style: "margin-bottom:8px" }, ["Obrigatório pra sair da Entrada."]));

    const nome = h("input", { class: "floow-input", placeholder: "Nome do decisor" }) as HTMLInputElement;
    nome.value = lead.nome || "";
    const empresa = h("input", { class: "floow-input", placeholder: "Empresa" }) as HTMLInputElement;
    empresa.value = lead.empresa || "";
    const insta = h("input", { class: "floow-input", placeholder: "Instagram (sem @)" }) as HTMLInputElement;
    insta.value = lead.instagram || "";

    const seg = h("select", { class: "floow-input" }) as HTMLSelectElement;
    seg.append(h("option", { value: "" }, ["Segmento…"]));
    for (const s of SEGMENTO_OPTIONS) {
      const opt = h("option", { value: s }, [SEGMENTO_LABELS[s]]);
      if (lead.segmento === s) opt.setAttribute("selected", "true");
      seg.append(opt);
    }

    const confirm = h("button", { class: "floow-btn floow-btn-primary", style: "margin-top:10px" }, ["Confirmar"]);
    confirm.addEventListener("click", () => {
      const n = nome.value.trim(), e = empresa.value.trim(), i = insta.value.trim().replace(/^@/, ""), sg = seg.value;
      if (!n || !e || !i || !sg) { api.setError("Preencha decisor, empresa, Instagram e segmento."); return; }
      api.done({ nome: n, empresa: e, instagram: i, segmento: sg });
    });

    wrap.append(
      h("div", { class: "floow-qlabel" }, ["Decisor"]), nome,
      h("div", { class: "floow-qlabel" }, ["Empresa"]), empresa,
      h("div", { class: "floow-qlabel" }, ["Instagram"]), insta,
      h("div", { class: "floow-qlabel" }, ["Segmento"]), seg,
      confirm,
    );
    return wrap;
  });
}

// Edição livre das informações do lead (sem mover etapa) — igual editar no CRM.
// Salva direto no banco e atualiza a UI. Devolve os campos alterados ou null.
function editLeadModal(lead: Lead): Promise<Record<string, unknown> | null> {
  return openModal("Editar informações", (api) => {
    const wrap = h("div", {});

    const nome = h("input", { class: "floow-input", placeholder: "Nome do decisor" }) as HTMLInputElement;
    nome.value = lead.nome || "";
    const empresa = h("input", { class: "floow-input", placeholder: "Empresa" }) as HTMLInputElement;
    empresa.value = lead.empresa || "";
    const insta = h("input", { class: "floow-input", placeholder: "Instagram (sem @)" }) as HTMLInputElement;
    insta.value = lead.instagram || "";
    const tel = h("input", { class: "floow-input", placeholder: "WhatsApp (com DDD)", inputmode: "tel" }) as HTMLInputElement;
    tel.value = lead.telefone || "";

    const seg = h("select", { class: "floow-input" }) as HTMLSelectElement;
    seg.append(h("option", { value: "" }, ["Segmento…"]));
    for (const s of SEGMENTO_OPTIONS) {
      const opt = h("option", { value: s }, [SEGMENTO_LABELS[s]]);
      if (lead.segmento === s) opt.setAttribute("selected", "true");
      seg.append(opt);
    }

    const fonte = h("select", { class: "floow-input" }) as HTMLSelectElement;
    fonte.append(h("option", { value: "" }, ["Origem…"]));
    for (const f of FONTE_OPTIONS) {
      const opt = h("option", { value: f }, [FONTE_LABELS[f] ?? f]);
      if (lead.fonte === f) opt.setAttribute("selected", "true");
      fonte.append(opt);
    }

    // Estado → cidade (municípios reais do estado selecionado).
    const uf = h("select", { class: "floow-input" }) as HTMLSelectElement;
    uf.append(h("option", { value: "" }, ["Estado…"]));
    for (const u of ESTADO_OPTIONS) {
      const opt = h("option", { value: u }, [`${u} — ${UF_LABELS[u]}`]);
      if (lead.estado === u) opt.setAttribute("selected", "true");
      uf.append(opt);
    }
    const cidadeSel = h("select", { class: "floow-input" }) as HTMLSelectElement;
    const fillCidades = (estado: string, selected: string | null) => {
      cidadeSel.innerHTML = "";
      cidadeSel.append(h("option", { value: "" }, [estado ? "Cidade…" : "Escolha o estado primeiro"]));
      for (const c of cidadesForUf(estado)) {
        const opt = h("option", { value: c }, [c]);
        if (selected === c) opt.setAttribute("selected", "true");
        cidadeSel.append(opt);
      }
    };
    fillCidades(lead.estado || "", lead.cidade || null);
    uf.addEventListener("change", () => fillCidades(uf.value, null));

    const confirm = h("button", { class: "floow-btn floow-btn-primary", style: "margin-top:10px" }, ["Salvar alterações"]) as HTMLButtonElement;
    confirm.addEventListener("click", async () => {
      const n = nome.value.trim();
      if (!n) { api.setError("O nome do decisor é obrigatório."); return; }
      if (!tel.value.trim()) { api.setError("O WhatsApp é obrigatório."); return; }
      const patch: Record<string, unknown> = {
        nome: n,
        empresa: empresa.value.trim() || null,
        instagram: insta.value.trim().replace(/^@/, "") || null,
        telefone: tel.value.trim(),
        segmento: seg.value || null,
        fonte: fonte.value || null,
        estado: uf.value || null,
        cidade: cidadeSel.value || null,
      };
      confirm.disabled = true; confirm.textContent = "Salvando…";
      const { error } = await supabase.from("leads").update(patch).eq("id", lead.id);
      if (error) { confirm.disabled = false; confirm.textContent = "Salvar alterações"; api.setError("Erro ao salvar: " + error.message); return; }
      await supabase.from("lead_events").insert({
        lead_id: lead.id, tipo: "note", actor_email: sessionEmail, actor_name: member.name,
        payload: { via: "whatsapp_ext", note: "Informações do lead editadas pela extensão" },
      });
      api.done(patch);
    });

    wrap.append(
      h("div", { class: "floow-qlabel" }, ["Decisor"]), nome,
      h("div", { class: "floow-qlabel" }, ["Empresa"]), empresa,
      h("div", { class: "floow-qlabel" }, ["Instagram"]), insta,
      h("div", { class: "floow-qlabel" }, ["WhatsApp"]), tel,
      h("div", { class: "floow-qlabel" }, ["Segmento"]), seg,
      h("div", { class: "floow-qlabel" }, ["Origem"]), fonte,
      h("div", { class: "floow-qlabel" }, ["Estado"]), uf,
      h("div", { class: "floow-qlabel" }, ["Cidade"]), cidadeSel,
      confirm,
    );
    return wrap;
  });
}

function askReason(title: string, labels: Record<string, string>): Promise<string | null> {
  return openModal(title, (api) => {
    const wrap = h("div", { class: "floow-pills" });
    for (const [val, label] of Object.entries(labels)) {
      const b = h("button", { class: "floow-pill" }, [label]);
      b.addEventListener("click", () => api.done(val));
      wrap.append(b);
    }
    return wrap;
  });
}

// Negócio GANHO: valor do negócio é OBRIGATÓRIO; criativo é opcional.
function askCreative(lead: Lead): Promise<{ code: number | null; valor: number } | null> {
  return openModal("🎉 Registrar negócio ganho", (api) => {
    const wrap = h("div", {});

    const valor = h("input", { type: "number", min: "1", step: "1", placeholder: "Ex: 1397", class: "floow-input" }) as HTMLInputElement;
    if (lead.valor != null) valor.value = String(lead.valor);

    const input = h("input", { type: "number", min: "1", placeholder: "Ex: 12 (opcional)", class: "floow-input" }) as HTMLInputElement;
    if (lead.criativo_codigo != null) input.value = String(lead.criativo_codigo);

    const done = (code: number | null) => {
      const v = Number(valor.value);
      if (!valor.value.trim() || !Number.isFinite(v) || v <= 0) { api.setError("Informe o valor do negócio (obrigatório)."); return; }
      api.done({ code, valor: v });
    };
    const ok = h("button", { class: "floow-btn floow-btn-primary", style: "margin-top:4px" }, ["Confirmar negócio ganho"]);
    ok.addEventListener("click", () => { const v = input.value.trim(); done(v ? Number(v) : null); });
    const skip = h("button", { class: "floow-btn", style: "margin-top:6px" }, ["Sem criativo"]);
    skip.addEventListener("click", () => done(null));

    wrap.append(
      h("div", { class: "floow-qlabel" }, ["Valor do negócio (R$) *"]), valor,
      h("div", { class: "floow-qlabel" }, ["Criativo (anúncio) — opcional"]), input,
      ok, skip,
    );
    return wrap;
  });
}

function askCloserDate(lead: Lead): Promise<{ closer: string; dataIso: string; local: string } | null> {
  return openModal("Agendar reunião", (api) => {
    const wrap = h("div", {});
    let sel: string | null = lead.closer_responsavel ?? null;
    const pills = h("div", { class: "floow-pills" });
    if (!closers.length) pills.append(h("div", { class: "floow-hint" }, ["Nenhum Closer cadastrado."]));
    for (const c of closers) {
      const b = h("button", { class: "floow-pill" + (sel === c.name ? " sel" : "") }, [c.name]);
      b.addEventListener("click", () => { sel = c.name; pills.querySelectorAll(".floow-pill").forEach((x) => x.classList.remove("sel")); b.classList.add("sel"); });
      pills.append(b);
    }
    // Formato (obrigatório): presencial ou online.
    let localSel: string | null = lead.local ?? null;
    const localPills = h("div", { class: "floow-pills" });
    for (const [val, lbl] of [["online", "💻 Online"], ["presencial", "📍 Presencial"]]) {
      const b = h("button", { class: "floow-pill" + (localSel === val ? " sel" : "") }, [lbl]);
      b.addEventListener("click", () => { localSel = val; localPills.querySelectorAll(".floow-pill").forEach((x) => x.classList.remove("sel")); b.classList.add("sel"); });
      localPills.append(b);
    }
    const dt = h("input", { type: "datetime-local", class: "floow-input" }) as HTMLInputElement;
    if (lead.data_agendamento) {
      const d = new Date(lead.data_agendamento); const p = (n: number) => String(n).padStart(2, "0");
      dt.value = `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
    }
    const ok = h("button", { class: "floow-btn floow-btn-primary", style: "margin-top:10px" }, ["Confirmar reunião"]);
    ok.addEventListener("click", () => {
      if (!sel) { api.setError("Escolha o Closer."); return; }
      if (!localSel) { api.setError("Escolha o formato (presencial ou online)."); return; }
      if (!dt.value) { api.setError("Escolha data e hora."); return; }
      api.done({ closer: sel, dataIso: new Date(dt.value).toISOString(), local: localSel });
    });
    wrap.append(
      h("div", { class: "floow-qlabel" }, ["Closer responsável *"]), pills,
      h("div", { class: "floow-qlabel", style: "margin-top:10px" }, ["Formato *"]), localPills,
      h("div", { class: "floow-qlabel", style: "margin-top:10px" }, ["Data e hora *"]), dt, ok,
      h("div", { class: "floow-hint", style: "margin-top:8px" }, ["Reunião de 45 min. O evento no Google Agenda é criado/ajustado pelo app."]),
    );
    return wrap;
  });
}

// ============================================================
// Ligações — inicia (best-effort) + registra no histórico do lead
// ============================================================
// ---- Gravação de ligação (áudio da aba = voz do lead + microfone = voz do SDR) ----
// LIGA/DESLIGA é decisão do ADMIN (coluna team_members.record_calls). O SDR NÃO altera.
type ActiveRecording = { stop: () => Promise<Blob | null>; cancel: () => void };

// Só o admin pode trocar o próprio estado pela extensão; grava no banco.
async function setRecordCallsAdmin(v: boolean) {
  if (!member.isAdmin) return;
  member.recordCalls = v;
  render();
  try { await supabase.from("team_members").update({ record_calls: v }).eq("email", sessionEmail); } catch { /* noop */ }
}

// Formatos candidatos, do mais desejado ao mais compatível. webm/opus é o que o
// Chrome grava DE VERDADE pra esse áudio mixado (aba+mic). O mp4 fica como opção,
// mas só é usado se o MediaRecorder conseguir CONSTRUIR com ele (isTypeSupported
// mente às vezes) — senão cai pro webm. Prioriza confiabilidade.
const REC_MIME_CANDIDATES = ["audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus", "audio/mp4"];
function makeRecorder(stream: MediaStream): { rec: MediaRecorder; mime: string } | null {
  for (const m of REC_MIME_CANDIDATES) {
    try {
      if (!MediaRecorder.isTypeSupported(m)) continue;
      const rec = new MediaRecorder(stream, { mimeType: m });
      return { rec, mime: m };
    } catch { /* tenta o próximo */ }
  }
  try { return { rec: new MediaRecorder(stream), mime: "audio/webm" }; } catch { return null; }
}

// Extensão do arquivo a partir do mime do blob gravado.
function recExt(mime: string): string {
  if (mime.includes("mp4")) return "mp4";
  if (mime.includes("ogg")) return "ogg";
  return "webm";
}

// Captura o áudio da ABA (voz do lead, que toca no WhatsApp Web) via getDisplayMedia
// + o MICROFONE (voz do SDR), mistura os dois no Web Audio e grava com MediaRecorder.
// Retorna null se o usuário negar/cancelar (aí a ligação segue sem gravação).
async function startCallRecording(): Promise<ActiveRecording | null> {
  let display: MediaStream | null = null;
  let mic: MediaStream | null = null;
  try {
    display = await navigator.mediaDevices.getDisplayMedia({
      video: true,
      audio: true,
      // @ts-expect-error preferCurrentTab é específico do Chrome (pré-seleciona esta aba)
      preferCurrentTab: true,
    });
  } catch { return null; }
  const tabAudio = display.getAudioTracks();
  try { mic = await navigator.mediaDevices.getUserMedia({ audio: true }); } catch { mic = null; }
  if (tabAudio.length === 0 && !mic) { display.getTracks().forEach((t) => t.stop()); return null; }

  // Não precisamos do vídeo — só do áudio da aba.
  display.getVideoTracks().forEach((t) => t.stop());

  const AC: typeof AudioContext = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const ctx = new AC();
  const dest = ctx.createMediaStreamDestination();
  if (tabAudio.length) ctx.createMediaStreamSource(new MediaStream(tabAudio)).connect(dest);
  if (mic) ctx.createMediaStreamSource(mic).connect(dest);

  const made = makeRecorder(dest.stream);
  if (!made) { flash("Navegador não suporta gravação de áudio."); try { display.getTracks().forEach((t) => t.stop()); mic?.getTracks().forEach((t) => t.stop()); void ctx.close(); } catch { /* noop */ } return null; }
  const { rec, mime } = made;
  const chunks: BlobPart[] = [];
  rec.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };
  rec.onerror = () => flash("Erro na gravação — tente de novo.");
  rec.start(1000);

  const cleanup = () => {
    try { display?.getTracks().forEach((t) => t.stop()); } catch { /* noop */ }
    try { mic?.getTracks().forEach((t) => t.stop()); } catch { /* noop */ }
    try { void ctx.close(); } catch { /* noop */ }
  };
  return {
    stop: () => new Promise<Blob | null>((resolve) => {
      const done = () => { cleanup(); resolve(chunks.length ? new Blob(chunks, { type: mime }) : null); };
      if (rec.state === "inactive") { done(); return; }
      rec.onstop = done;
      try { rec.stop(); } catch { done(); }
    }),
    cancel: () => { try { if (rec.state !== "inactive") rec.stop(); } catch { /* noop */ } cleanup(); },
  };
}

// Sobe a gravação pro bucket `call-recordings` (organizado por lead).
async function uploadRecording(lead: Lead, blob: Blob): Promise<{ path: string; url: string } | null> {
  const ext = recExt(blob.type);
  const path = `${lead.id}/${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from("call-recordings").upload(path, blob, { contentType: blob.type || "audio/webm", upsert: false });
  if (error) { console.error("[floow] upload gravação:", error.message); return null; }
  const { data } = supabase.storage.from("call-recordings").getPublicUrl(path);
  return { path, url: data.publicUrl };
}

// Popup pós-ligação: prévia do áudio + nome (com padrão) + Salvar / Excluir.
type RecordingResult = { action: "save"; name: string; descricao: string } | { action: "delete" };
function openRecordingModal(defaultName: string, audioUrl: string, durationMs: number): Promise<RecordingResult | null> {
  return openModal<RecordingResult>("🎙️ Gravação da ligação", (api) => {
    const wrap = h("div", {});
    const dur = Math.round(durationMs / 1000);
    const durTxt = dur >= 60 ? `${Math.floor(dur / 60)}m${String(dur % 60).padStart(2, "0")}s` : `${dur}s`;

    const audio = h("audio", { controls: "true", src: audioUrl, style: "width:100%;margin:2px 0 8px" }) as HTMLAudioElement;

    const nameIn = h("input", { class: "floow-input", value: defaultName, title: "Nome da gravação" }) as HTMLInputElement;
    const descIn = h("textarea", { class: "floow-input floow-textarea", placeholder: "Descrição (opcional) — objeções, próximos passos, contexto…" }) as HTMLTextAreaElement;

    const save = h("button", { class: "floow-btn floow-btn-primary", style: "margin-top:8px" }, ["💾 Salvar gravação"]);
    save.addEventListener("click", () => {
      const name = nameIn.value.trim() || defaultName;
      api.done({ action: "save", name, descricao: descIn.value.trim() });
    });
    const del = h("button", { class: "floow-btn", style: "margin-top:6px;color:#fca5a5" }, ["🗑️ Excluir gravação"]);
    del.addEventListener("click", () => api.done({ action: "delete" }));

    wrap.append(
      h("div", { class: "floow-hint", style: "margin-bottom:6px" }, [`Duração: ${durTxt}. Ouça antes de salvar.`]),
      audio,
      h("div", { class: "floow-qlabel" }, ["Nome da gravação"]),
      nameIn,
      h("div", { class: "floow-qlabel", style: "margin-top:10px" }, ["Descrição (opcional)"]),
      descIn,
      save,
      del,
    );
    return wrap;
  });
}

// ============================================================
// Webphone API4COM (ligação por telefone, embutido na extensão)
// ============================================================
let webphoneWidgetMounted = false;

// Widget flutuante (canto inferior esquerdo, pra não cobrir o painel à direita):
// status online + controles da ligação (cronômetro/mudo/desligar). Montado UMA vez
// (assina o webphone uma vez) — o botão do painel só dispara placeCall.
function mountWebphoneWidget(): void {
  if (webphoneWidgetMounted) return;
  webphoneWidgetMounted = true;

  // Quando uma ligação por telefone (API4COM) termina, abre o popup de resultado —
  // igual à ligação pelo WhatsApp. A escolha manual vira a verdade (sobrepõe o
  // palpite automático do webhook).
  extWebphone.setOnCallEnded(async (call) => {
    const outcome = await askReason("Como foi a ligação?", CALL_OUTCOME_PHONE_LABELS);
    if (!outcome) return; // pulou → fica o resultado automático do webhook
    await extWebphone.submitOutcome(call.callId, call.leadId, outcome);
    flash(`Ligação registrada (${CALL_OUTCOME_PHONE_LABELS[outcome] ?? outcome}) ✓`);
  });
  const box = h("div", {
    id: "floow-webphone-widget",
    style: "position:fixed;bottom:16px;left:16px;z-index:2147483646;font-family:system-ui,sans-serif;display:none",
  });
  document.body.appendChild(box);

  let timerIv: ReturnType<typeof setInterval> | null = null;
  const fmt = (ms: number) => { const s = Math.max(0, Math.floor(ms / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`; };

  extWebphone.subscribe((st) => {
    if (timerIv) { clearInterval(timerIv); timerIv = null; }
    box.textContent = "";
    if (st.status === "idle") { box.style.display = "none"; return; }
    box.style.display = "block";

    if (st.status === "incall" || st.status === "calling") {
      const title = h("div", { style: "font-size:12px;font-weight:600;color:#e5e7eb;margin-bottom:2px" }, [st.label || "Ligação"]);
      const sub = h("div", { style: "font-size:11px;color:#94a3b8;margin-bottom:8px" });
      const upd = () => { sub.textContent = st.status === "incall" && st.startedAt ? `Em ligação · ${fmt(Date.now() - st.startedAt)}` : "Discando… atenda no fone"; };
      upd();
      if (st.status === "incall") timerIv = setInterval(upd, 500);
      const mute = h("button", { style: "flex:1;padding:6px;border-radius:8px;border:1px solid #475569;background:#1e293b;color:#e5e7eb;font-size:11px;cursor:pointer" }, [st.muted ? "🔇 Mudo" : "🎙️ Mic"]);
      mute.addEventListener("click", () => extWebphone.toggleMute());
      const hang = h("button", { style: "flex:1;padding:6px;border-radius:8px;border:0;background:#dc2626;color:#fff;font-size:11px;font-weight:600;cursor:pointer" }, ["📴 Desligar"]);
      hang.addEventListener("click", () => extWebphone.hangup());
      const row = h("div", { style: "display:flex;gap:8px" }, [mute, hang]);
      const card = h("div", { style: "background:#0f141b;border:1px solid #334155;border-radius:12px;padding:10px 12px;box-shadow:0 8px 30px rgba(0,0,0,.5);min-width:200px" }, [title, sub, row]);
      box.append(card);
    } else {
      const map: Record<string, [string, string, boolean]> = {
        loading: ["Conectando telefone…", "#38bdf8", false],
        connecting: ["Conectando telefone…", "#38bdf8", false],
        online: ["📞 Telefone online", "#34d399", false],
        offline: ["Ficar online", "#cbd5e1", true],
        error: [st.error || "Telefone: erro", "#f87171", true],
      };
      const [txt, color, click] = map[st.status] ?? ["", "#94a3b8", false];
      const chip = h("div", { style: `background:#0f141b;border:1px solid #334155;border-radius:999px;padding:6px 12px;font-size:11px;color:${color};box-shadow:0 4px 16px rgba(0,0,0,.4);cursor:${click ? "pointer" : "default"};max-width:240px` }, [txt]);
      if (click) chip.addEventListener("click", () => { extWebphone.ensureOnline(); });
      box.append(chip);
    }
  });
}

function buildApi4comCallButton(lead: Lead): Node {
  const btn = h("button", {
    class: "floow-btn",
    style: "background:#0c2a3a;color:#7dd3fc;border:1px solid #38bdf855;margin-top:6px",
    title: "Liga por telefone (API4COM) — webphone embutido na extensão",
  }, ["📞 Ligar (telefone)"]);
  const label = String(lead.empresa || lead.nome || lead.telefone || "");
  btn.addEventListener("click", async () => {
    btn.setAttribute("disabled", "true");
    try {
      await extWebphone.placeCall({ leadId: lead.id, phone: lead.telefone, label });
    } catch (e) {
      flash(e instanceof Error ? e.message : "Erro ao ligar.");
    } finally {
      btn.removeAttribute("disabled");
    }
  });
  return btn;
}

async function handleCall(lead: Lead, _digits: string) {
  // 1) Inicia a ligação SEMPRE no WhatsApp Web (clica no botão de voz nativo).
  //    NUNCA abrir o app do WhatsApp — a ligação é aqui no Web (decisão fechada).
  const started = startNativeCall();
  if (!started) {
    // Best-effort: não achou o botão nativo. Sem alarme — só orienta a clicar no
    // botão de ligar do próprio WhatsApp Web e segue registrando o resultado.
    flash("Clique no botão de ligar do WhatsApp Web e informe o resultado abaixo.");
  }

  // 2) Se a gravação estiver ligada (definido pelo ADMIN), começa a gravar já.
  let rec: ActiveRecording | null = null;
  const recStart = Date.now();
  if (member.recordCalls) {
    flash("Pra gravar: escolha \"Esta aba\" e marque \"Compartilhar áudio da aba\".");
    rec = await startCallRecording();
    if (rec) flash("🔴 Gravando a ligação…");
    else flash("Gravação não iniciada (permissão negada) — a ligação segue normal.");
  }

  // 3) Pergunta o resultado.
  const outcome = await askReason("Como foi a ligação?", CALL_OUTCOME_LABELS);
  if (!outcome) { rec?.cancel(); return; } // cancelou → descarta gravação e não registra

  // 4) Só abre o popup de salvar/excluir quando o lead ATENDEU. Nas outras opções
  //    (rejeitou, chamou até cair, atendeu mas desligou, não chamou) descarta o
  //    áudio automaticamente e só registra a ligação.
  if (rec) {
    if (outcome === "atendeu") {
      const blob = await rec.stop();
      if (blob && blob.size > 0) { await saveRecordingFlow(lead, outcome, blob, Date.now() - recStart); return; }
      flash("Nada foi capturado na gravação — registrando a ligação.");
    } else {
      rec.cancel(); // descarta a gravação (não atendeu de fato)
    }
  }
  await logCall(lead, outcome);
}

// Fluxo pós-gravação: prévia + nome (com padrão) + Salvar / Excluir.
async function saveRecordingFlow(lead: Lead, outcome: string, blob: Blob, durationMs: number) {
  const url = URL.createObjectURL(blob);
  const now = new Date();
  const hora = now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  const data = now.toLocaleDateString("pt-BR");
  const quem = lead.empresa || lead.nome || "Lead";
  const defaultName = `${quem} | ${hora} | ${data} | ${CALL_OUTCOME_LABELS[outcome] ?? outcome}`;
  const res = await openRecordingModal(defaultName, url, durationMs);
  URL.revokeObjectURL(url);

  if (!res || res.action === "delete") {
    await logCall(lead, outcome); // registra a ligação, sem áudio
    flash(res?.action === "delete" ? "Gravação excluída. Ligação registrada ✓" : "Ligação registrada ✓");
    return;
  }
  // Salvar → sobe pro Storage e anexa no histórico do lead.
  flash("Enviando gravação…");
  const up = await uploadRecording(lead, blob);
  if (!up) { flash("Falha ao enviar o áudio — ligação registrada sem gravação."); await logCall(lead, outcome); return; }
  await logCall(lead, outcome, { name: res.name, descricao: res.descricao || undefined, path: up.path, url: up.url, durationMs, mime: blob.type, size: blob.size });
  flash("Gravação salva ✓");
}

async function logCall(lead: Lead, outcome: string, recording?: Record<string, unknown>) {
  const payload: Record<string, unknown> = { via: "whatsapp_ext", outcome, by: member.name };
  if (recording) payload.recording = recording;
  const { error } = await supabase.from("lead_events").insert({
    lead_id: lead.id,
    tipo: "ligacao",
    actor_email: sessionEmail,
    actor_name: member.name,
    payload,
  });
  if (error) { flash("Não registrou a ligação: " + error.message); return; }
  flash(`Ligação registrada (${CALL_OUTCOME_LABELS[outcome] ?? outcome}) ✓`);

  // REAQUECIMENTO por LIGAÇÃO: se o lead ATENDEU (falou), ele é um sinal de contato
  // igual responder mensagem → reaquece a temperatura (last_inbound_at = agora).
  if (outcome === "atendeu" || outcome === "atendeu_desligou") {
    const nowIso = new Date().toISOString();
    lead.last_inbound_at = nowIso; // reflete na hora no card
    await supabase.from("leads").update({ last_inbound_at: nowIso }).eq("id", lead.id);
  }

  // Conta essa ligação no termômetro do dia (colore o card na hora).
  callsToday.set(lead.id, (callsToday.get(lead.id) ?? 0) + 1);
  // Atualiza o contador na hora.
  const info = panel?.querySelector(".floow-callinfo") as HTMLElement | null;
  if (info) refreshCallHistory(lead.id, info);
}

// Conta as ligações do lead e mostra "📞 N ligações · última: …".
type LigacaoRow = { id: string; payload?: { outcome?: string; recording?: RecInfo }; created_at: string };
type RecInfo = { name?: string; path?: string; url?: string; durationMs?: number; descricao?: string; mime?: string; size?: number };

async function refreshCallHistory(leadId: string, node: HTMLElement) {
  const { data, error } = await supabase
    .from("lead_events")
    .select("id, payload, created_at")
    .eq("lead_id", leadId)
    .eq("tipo", "ligacao")
    .order("created_at", { ascending: false });
  if (error) { node.textContent = ""; return; }
  const rows = (data ?? []) as LigacaoRow[];
  node.textContent = "";
  if (rows.length === 0) { node.textContent = "📞 Nenhuma ligação registrada"; return; }

  node.append(h("div", {}, [`📞 ${rows.length} ${rows.length > 1 ? "ligações" : "ligação"}`]));

  // TODAS as ligações (mais recente primeiro): data · resultado + descrição/gravação.
  const list = h("div", { style: "margin-top:6px;display:flex;flex-direction:column;gap:8px" });
  for (const r of rows) {
    const out = r.payload?.outcome ? (CALL_OUTCOME_LABELS[r.payload.outcome] ?? r.payload.outcome) : "—";
    const item = h("div", { style: "display:flex;flex-direction:column;gap:3px" });
    item.append(h("div", { style: "font-size:11px;color:#c7c7cf" }, [`📞 ${fmtDate(r.created_at)} · ${out}`]));
    const rec = r.payload?.recording;
    if (rec?.descricao) item.append(h("div", { style: "font-size:10px;font-style:italic;color:#9a9aa3;padding-left:16px" }, [`"${rec.descricao}"`]));
    if (rec?.path) item.append(recordingRow(rec, r.created_at, r.id, leadId, node));
    list.append(item);
  }
  node.append(list);
}

// Uma linha de gravação com botão "Ouvir" (gera URL assinada do bucket privado)
// e, pro admin, um botão de excluir (apaga o áudio no Storage + no card/Backlog).
// Player de áudio com SEEK (arrastar/pular) + VELOCIDADE — igual o AudioPlayer do CRM.
// Corrige a duração do WebM/Opus do MediaRecorder (vem sem índice → seek travado):
// força o browser a indexar o arquivo (seek pra um tempo enorme e volta), MUDO pra
// não tocar o fim no meio. Usa durationMs (do banco) como duração conhecida.
function buildExtAudioPlayer(src: string, durationMs?: number): HTMLElement {
  const SPEEDS = [1, 1.25, 1.5, 2];
  let speedIdx = 0, fixed = false, fixing = false;
  let dur = durationMs ? durationMs / 1000 : 0;
  const audio = h("audio", { src, preload: "metadata", autoplay: "true", style: "display:none" }) as HTMLAudioElement;
  const playBtn = h("button", { class: "floow-link", style: "flex:none;font-size:15px;line-height:1" }, ["▶"]) as HTMLButtonElement;
  const fill = h("div", { style: "position:absolute;left:0;top:0;bottom:0;border-radius:999px;background:#f5c518;width:0%" });
  const bar = h("div", { style: "position:relative;flex:1;height:6px;border-radius:999px;background:#2a2a30;cursor:pointer", title: "Clique pra adiantar" }, [fill]);
  const timeEl = h("span", { style: "flex:none;font-size:10px;color:#71717a;font-variant-numeric:tabular-nums" }, ["0:00 / 0:00"]);
  const speedBtn = h("button", { class: "floow-link", style: "flex:none;font-size:10px;font-weight:700", title: "Velocidade" }, ["1×"]) as HTMLButtonElement;
  const row = h("div", { style: "display:flex;align-items:center;gap:8px;margin-top:8px" }, [audio, playBtn, bar, timeEl, speedBtn]);

  const fmt = (s: number) => { if (!isFinite(s) || s < 0) s = 0; return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`; };
  const total = () => dur || (durationMs ? durationMs / 1000 : 0);

  const fixDuration = () => {
    if (fixed) return; fixed = true;
    if (audio.duration === Infinity || isNaN(audio.duration)) {
      fixing = true; audio.muted = true;
      const onU = () => {
        audio.removeEventListener("timeupdate", onU);
        try { audio.currentTime = 0; } catch { /* noop */ }
        audio.muted = false; fixing = false;
        if (isFinite(audio.duration) && audio.duration > 0) dur = audio.duration;
      };
      audio.addEventListener("timeupdate", onU);
      try { audio.currentTime = 1e101; } catch { /* noop */ }
    } else if (isFinite(audio.duration) && audio.duration > 0) { dur = audio.duration; }
  };
  audio.addEventListener("loadedmetadata", fixDuration);
  audio.addEventListener("timeupdate", () => {
    if (fixing) return;
    const t = total();
    fill.style.width = t > 0 ? `${Math.min(100, (audio.currentTime / t) * 100)}%` : "0%";
    timeEl.textContent = `${fmt(audio.currentTime)} / ${fmt(t)}`;
  });
  audio.addEventListener("play", () => { playBtn.textContent = "⏸"; });
  audio.addEventListener("pause", () => { playBtn.textContent = "▶"; });
  audio.addEventListener("ended", () => { playBtn.textContent = "▶"; });

  playBtn.addEventListener("click", () => { if (audio.paused) audio.play().catch(() => {}); else audio.pause(); });
  bar.addEventListener("click", (e) => {
    const t = total(); if (t <= 0) return;
    const rect = bar.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, ((e as MouseEvent).clientX - rect.left) / rect.width));
    try { audio.currentTime = ratio * t; } catch { /* noop */ }
  });
  speedBtn.addEventListener("click", () => {
    speedIdx = (speedIdx + 1) % SPEEDS.length;
    audio.playbackRate = SPEEDS[speedIdx];
    speedBtn.textContent = `${SPEEDS[speedIdx]}×`;
  });

  return row;
}

function recordingRow(rec: RecInfo, createdAt: string, eventId: string, leadId: string, hostNode: HTMLElement): HTMLElement {
  const dur = rec.durationMs ? Math.round(rec.durationMs / 1000) : null;
  const durTxt = dur != null ? (dur >= 60 ? `${Math.floor(dur / 60)}m${String(dur % 60).padStart(2, "0")}s` : `${dur}s`) : "";
  const quando = fmtDate(createdAt);
  const wrap = h("div", { style: "border:1px solid #26262b;border-radius:6px;padding:6px 8px;background:#131316" });
  const head = h("div", { style: "display:flex;align-items:center;gap:6px" });
  const label = h("span", { style: "flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:11px;color:#c7c7cf", title: rec.name || "Gravação" }, [`🎙️ ${rec.name || "Gravação"}`]);
  const meta = h("span", { style: "flex:none;font-size:10px;color:#71717a" }, [durTxt ? `${durTxt}` : quando]);
  const btn = h("button", { class: "floow-link", style: "flex:none" }, ["▶ Ouvir"]) as HTMLButtonElement;
  head.append(label, meta, btn);
  // Excluir gravação — só admin.
  if (member.isAdmin) {
    const delBtn = h("button", { class: "floow-link", style: "flex:none;color:#fca5a5", title: "Excluir gravação" }, ["🗑"]) as HTMLButtonElement;
    delBtn.addEventListener("click", async () => {
      if (!confirm("Excluir esta gravação? O áudio some do card e do Backlog. O registro da ligação continua.")) return;
      delBtn.disabled = true; delBtn.textContent = "…";
      const res = await deleteRecording(eventId);
      if (!res.ok) { delBtn.disabled = false; delBtn.textContent = "🗑"; flash("Não consegui excluir: " + (res.error || "erro")); return; }
      flash("Gravação excluída ✓");
      refreshCallHistory(leadId, hostNode);
    });
    head.append(delBtn);
  }
  wrap.append(head);

  let player: HTMLElement | null = null;
  let blobUrl: string | null = null;
  btn.addEventListener("click", async () => {
    if (player) {
      player.remove(); player = null;
      if (blobUrl) { URL.revokeObjectURL(blobUrl); blobUrl = null; }
      btn.textContent = "▶ Ouvir"; return;
    }
    btn.textContent = "carregando…"; btn.disabled = true;
    let src = rec.url ?? null;
    if (rec.path) {
      const { data } = await supabase.storage.from("call-recordings").createSignedUrl(rec.path, 3600);
      src = data?.signedUrl ?? src;
    }
    if (!src) { btn.disabled = false; btn.textContent = "erro ao carregar"; return; }
    // O WhatsApp Web bloqueia mídia de origem externa (CSP media-src). Baixamos o
    // arquivo via fetch (isolated world da extensão → não sofre a CSP da página) e
    // tocamos de um blob: URL, que a CSP permite. Bônus: o arquivo inteiro em
    // memória faz o seek do WebM funcionar de verdade.
    try {
      const resp = await fetch(src);
      if (!resp.ok) throw new Error(String(resp.status));
      const raw = await resp.blob();
      const type = raw.type && raw.type.startsWith("audio") ? raw.type : (rec.mime || "audio/webm");
      const blob = type === raw.type ? raw : new Blob([raw], { type });
      blobUrl = URL.createObjectURL(blob);
    } catch (e) {
      btn.disabled = false;
      btn.textContent = "erro ao baixar";
      flash("Não consegui baixar a gravação: " + (e instanceof Error ? e.message : "erro"));
      return;
    }
    btn.disabled = false;
    btn.textContent = "⏹ Fechar";
    player = buildExtAudioPlayer(blobUrl, rec.durationMs);
    wrap.append(player);
  });
  return wrap;
}

// Exclui a gravação (só admin) via rota do app: apaga o áudio no Storage e tira a
// referência do evento — some do card do lead e do Backlog ao mesmo tempo.
async function deleteRecording(eventId: string): Promise<{ ok: boolean; error?: string }> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) return { ok: false, error: "sessão expirada" };
  try {
    const res = await fetch(`${APP_URL}/api/recordings/delete`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ eventId }),
    });
    const j = await res.json().catch(() => ({}));
    return { ok: !!j?.ok, error: j?.error };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "rede" };
  }
}

// ============================================================
// Mover etapa (com as regras do app)
// ============================================================
// Chama o app pra criar/atualizar/apagar o evento no Google Agenda (a extensão
// não tem acesso server-side ao Google).
async function reconcileCalendar(leadId: string): Promise<{ ok: boolean; action?: string; error?: string } | null> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) return null;
  try {
    const res = await fetch(`${APP_URL}/api/ext/calendar-reconcile`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ leadId }),
    });
    return await res.json();
  } catch {
    return null;
  }
}

// Envia um áudio pronto pro número do lead (via rota do app → Z-API).
async function sendAudio(a: AudioSnippet, phone: string, btn: HTMLButtonElement) {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) { flash("Sessão expirada — logue de novo."); return; }
  const original = btn.textContent;
  btn.disabled = true;
  btn.textContent = "Enviando…";
  try {
    const res = await fetch(`${APP_URL}/api/ext/send-audio`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ snippetId: a.id, phone }),
    });
    const json = await res.json().catch(() => ({}));
    if (json?.ok) flash(`Áudio "${a.name}" enviado ✓`);
    else flash("Falha: " + (json?.error || "erro ao enviar áudio"));
  } catch {
    flash("Erro de rede ao enviar áudio.");
  } finally {
    btn.disabled = false;
    btn.textContent = original;
  }
}

// Envia o vídeo de uma mensagem pronta (canned) pro lead, via /api/ext/send-video.
async function sendCannedVideo(m: CannedMessage, phone: string, btn: HTMLButtonElement) {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) { flash("Sessão expirada — logue de novo."); return; }
  const original = btn.textContent;
  btn.disabled = true;
  btn.textContent = "Enviando…";
  try {
    const res = await fetch(`${APP_URL}/api/ext/send-video`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ messageId: m.id, phone }),
    });
    const json = await res.json().catch(() => ({}));
    if (json?.ok) flash(`Vídeo "${m.title}" enviado ✓`);
    else flash("Falha: " + (json?.error || "erro ao enviar vídeo"));
  } catch {
    flash("Erro de rede ao enviar vídeo.");
  } finally {
    btn.disabled = false;
    btn.textContent = original;
  }
}

// Leads cuja conversa já foi auto-importada nesta sessão (evita repetir no re-render).
const autoImported = new Set<string>();

// Auto-import silencioso: ao abrir a conversa, espelha o trecho JÁ carregado (sem
// rolar a tela, sem aviso). O histórico profundo fica no botão manual.
async function autoImportHistory(lead: Lead, phone: string) {
  try {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) return;
    await new Promise((r) => setTimeout(r, 1500)); // deixa o WhatsApp carregar as mensagens
    const msgs = await scrapeConversationHistory(0); // 0 = sem rolar (só o visível)
    if (!msgs.length) return;
    await fetch(`${APP_URL}/api/conversas/ingest`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ phone, leadId: lead.id, messages: msgs }),
    });
  } catch { /* silencioso de propósito */ }
}

// Raspa a conversa ABERTA no WhatsApp Web e envia o histórico de texto pro CRM.
async function importHistory(lead: Lead, phone: string, btn: HTMLButtonElement) {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) { flash("Sessão expirada — logue de novo."); return; }
  const original = btn.textContent;
  btn.disabled = true;
  btn.textContent = "📥 Lendo a conversa… (rolando pra cima)";
  try {
    const msgs = await scrapeConversationHistory();
    if (!msgs.length) {
      const d = scrapeDebug();
      flash(`Não achei texto. (main=${d.main} datas=${d.prePlain} ids=${d.dataIds}) id="${d.sampleId}" — veja o console (F12).`);
      return;
    }
    btn.textContent = `📥 Enviando ${msgs.length} mensagens…`;
    const res = await fetch(`${APP_URL}/api/conversas/ingest`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ phone, leadId: lead.id, messages: msgs }),
    });
    const json = await res.json().catch(() => ({}));
    if (json?.ok) flash(`Histórico importado: ${json.inserted} nova(s) de ${msgs.length} lidas ✓`);
    else flash("Falha: " + (json?.error || "erro ao importar"));
  } catch (e) {
    flash("Erro ao importar: " + (e instanceof Error ? e.message : "erro"));
  } finally {
    btn.disabled = false;
    btn.textContent = original;
  }
}

// Vincula o contato aberto (o @lid E/OU o nome salvo) ao lead, pra casar sozinho depois.
async function linkChatToLead(lead: Lead, openId: string, openTitle: string, btn: HTMLButtonElement) {
  const original = btn.textContent;
  btn.disabled = true;
  btn.textContent = "Vinculando…";
  try {
    const waLid = (openId || "").replace(/\D/g, "");
    const contactName = (openTitle || "").trim();
    if (!waLid && !contactName) { flash("Não consegui ler o contato aberto."); return; }
    const { data } = await supabase.auth.getSession();
    const tk = data.session?.access_token;
    if (!tk) { flash("Sessão expirada — logue de novo."); return; }
    const res = await fetch(`${APP_URL}/api/ext/link-lid`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${tk}` },
      body: JSON.stringify({ leadId: lead.id, waLid, contactName }),
    });
    const json = await res.json().catch(() => ({}));
    if (!json?.ok) { flash("Falha ao vincular: " + (json?.error || "erro")); return; }
    lead.wa_lid = waLid || lead.wa_lid;
    lead.wa_contact_name = contactName || lead.wa_contact_name;
    const idx = leads.findIndex((l) => l.id === lead.id);
    if (idx >= 0) leads[idx] = { ...leads[idx], wa_lid: lead.wa_lid, wa_contact_name: lead.wa_contact_name };
    matchInfo = "por contato vinculado";
    pinned = false; // passa a casar automático
    flash("Contato vinculado ✓ — agora casa sozinho");
    render();
  } catch (e) {
    flash("Erro ao vincular: " + (e instanceof Error ? e.message : "erro"));
  } finally {
    btn.disabled = false;
    btn.textContent = original;
  }
}

async function beginMove(lead: Lead, target: LeadStatus) {
  if (!canMoveTo(target, member)) { flash("Sem permissão pra essa etapa"); return; }
  const prevEventId = lead.google_event_id;
  const patch = patchForStatus(target);

  // Trava 1: info do negócio (Pré qualificado em diante).
  if (needsBusinessInfo(lead, target) && !isPreQualComplete({ ...lead, ...patch } as Lead)) {
    const biz = await askBusinessInfo(lead);
    if (!biz) return;
    Object.assign(patch, biz);
  }
  // Trava 2: qualificação/BANT (Qualificado em diante).
  if (needsQualification(lead, target)) {
    const q = await askQualification(lead);
    if (!q) return;
    Object.assign(patch, q);
  }
  if (target === "negocio_perdido") {
    const m = await askReason("Motivo da perda", MOTIVO_PERDA_LABELS);
    if (!m) return; patch.motivo_perda = m;
  } else if (target === "desqualificado") {
    const m = await askReason("Motivo da desqualificação", MOTIVO_DESQUALIFICACAO_PICK);
    if (!m) return; patch.motivo_desqualificacao = m;
  } else if (target === "carteira") {
    const m = await askReason("Por que foi pra Carteira?", MOTIVO_CARTEIRA_LABELS);
    if (!m) return; patch.motivo_carteira = m;
  } else if (target === "negocio_ganho") {
    const c = await askCreative(lead);
    if (!c) return; patch.criativo_codigo = c.code; patch.valor = c.valor;
  } else if (target === "reuniao_agendada") {
    const r = await askCloserDate(lead);
    if (!r) return;
    patch.closer_responsavel = r.closer; patch.data_agendamento = r.dataIso; patch.local = r.local;
    patch.agendado_por = member.name; // quem realizou o agendamento
  }

  const { error } = await supabase.from("leads").update(patch).eq("id", lead.id);
  if (error) { flash("Não foi possível: " + error.message); return; }
  Object.assign(lead, patch);
  render();
  flash(`Movido para "${STATUS_LABELS[target]}" ✓`);

  // Sincroniza o Google Agenda: ao agendar (cria/atualiza) ou ao limpar o
  // agendamento de um lead que tinha evento (apaga).
  const clears = ["qualificado", "pre_qualificado", "em_agendamento", "agendando", "no_show", "desqualificado", "carteira"].includes(target);
  if (target === "reuniao_agendada" || (clears && prevEventId)) {
    flash("Sincronizando Google Agenda…");
    const r = await reconcileCalendar(lead.id);
    if (r?.ok && (r.action === "created" || r.action === "updated")) flash("Reunião no Google Agenda ✓");
    else if (r?.ok && r.action === "deleted") flash("Removido do Google Agenda ✓");
    else if (r && !r.ok) flash("Movido ✓ — Google Agenda: " + (r.error || "falhou"));
  }

  // Popups bloqueantes por etapa: 1º manda a mensagem → 2º a tarefa.
  if (target === "reuniao_agendada") {
    await blockingCopyModal("Confirmação no WhatsApp", msgConfirmacao(lead.nome, lead.data_agendamento), "Já enviei a confirmação");
  } else if (target === "follow_up") {
    await blockingCopyModal("Enviar proposta", msgProposta(lead.empresa || lead.nome), "Já enviei a proposta");
  }

  // Tarefa sugerida pela etapa (pré-preenchida, pode pular).
  const taskTipo = STAGE_TASK_TIPO[target];
  if (taskTipo) { await openTaskModal(lead, taskTipo); render(); }
}

// Popup BLOQUEANTE genérico: mostra a mensagem pra copiar; só segue ao marcar "feito".
function blockingCopyModal(title: string, msg: string, checkLabel: string): Promise<void> {
  return new Promise((resolve) => {
    const box = h("div", { style: "white-space:pre-wrap;background:#0f1218;border:1px solid #2a2f3a;border-radius:8px;padding:10px;font-size:13px;line-height:1.5;color:#e4e4e7" }, [msg]);
    const copyBtn = h("button", { class: "floow-btn floow-wa", style: "width:100%;margin-top:8px" }, ["Copiar mensagem"]) as HTMLButtonElement;
    copyBtn.addEventListener("click", async () => {
      try { await navigator.clipboard.writeText(msg); copyBtn.textContent = "Copiado ✓"; setTimeout(() => (copyBtn.textContent = "Copiar mensagem"), 1500); } catch { /* copiar na mão */ }
    });
    const chk = h("input", { type: "checkbox" }) as HTMLInputElement;
    const cont = h("button", { class: "floow-btn floow-btn-primary", style: "width:100%" }, ["Continuar"]) as HTMLButtonElement;
    cont.disabled = true;
    chk.addEventListener("change", () => { cont.disabled = !chk.checked; });
    cont.addEventListener("click", () => { if (!chk.checked) return; overlay.remove(); resolve(); });
    const label = h("label", { style: "display:flex;align-items:center;gap:8px;margin:10px 0;font-size:13px;color:#e4e4e7;cursor:pointer" }, [chk, `${checkLabel} (feito)`]);
    const overlay = h("div", { class: "floow-modal" }, [
      h("div", { class: "floow-modal-card" }, [
        h("div", { class: "floow-modal-head" }, [h("div", { class: "floow-title" }, [title])]),
        h("div", { class: "floow-modal-body" }, [box, copyBtn, label, cont]),
      ]),
    ]);
    panel.append(overlay);
  });
}

// Popup de tarefa ao mover no funil (pré-preenchido; fechar = pular).
function openTaskModal(lead: Lead, initialTipo: string): Promise<null> {
  return openModal<null>("Criar tarefa", (api) => {
    let tipo = initialTipo;
    const wrap = h("div", {});
    wrap.append(h("div", { class: "floow-hint", style: "margin-bottom:8px" }, ["Sugerida pela etapa. Edite ou feche pra pular."]));

    if (initialTipo === "lembrete_reuniao") {
      const m = msgLembrete(lead.nome, lead.data_agendamento, lead.local);
      const mb = h("div", { style: "white-space:pre-wrap;background:rgba(37,211,102,.06);border:1px solid rgba(37,211,102,.3);border-radius:8px;padding:8px;font-size:12px;line-height:1.5;color:#d4d4d8;margin-bottom:8px" }, [m]);
      const cp = h("button", { class: "floow-btn floow-wa", style: "width:100%;margin-bottom:8px" }, ["Copiar mensagem de lembrete"]) as HTMLButtonElement;
      cp.addEventListener("click", async () => { try { await navigator.clipboard.writeText(m); cp.textContent = "Copiado ✓"; setTimeout(() => (cp.textContent = "Copiar mensagem de lembrete"), 1500); } catch { /* copiar na mão */ } });
      wrap.append(mb, cp);
    }

    const titulo = h("input", { class: "floow-input" }) as HTMLInputElement;
    titulo.value = taskTitleFor(tipo, lead);
    const due = h("input", { class: "floow-input", type: "datetime-local", style: "color-scheme:dark" }) as HTMLInputElement;
    const sug = suggestedTaskDue(tipo, lead); if (sug) due.value = toLocalInput(sug);

    const pills = h("div", { class: "floow-pills", style: "margin-bottom:8px" });
    const paint = () => pills.querySelectorAll(".floow-pill").forEach((el) => {
      const on = (el as HTMLElement).dataset.tipo === tipo;
      (el as HTMLElement).style.cssText = on
        ? `border-color:${TASK_TIPO_COLORS[tipo]}88;background:${TASK_TIPO_COLORS[tipo]}22;color:${TASK_TIPO_COLORS[tipo]}`
        : "";
    });
    for (const tp of TASK_TIPO_OPTIONS) {
      const b = h("button", { class: "floow-pill", "data-tipo": tp }, [`${TASK_TIPO_ICONS[tp]} ${TASK_TIPO_LABELS[tp]}`]);
      b.addEventListener("click", () => {
        if (!titulo.value.trim() || titulo.value === taskTitleFor(tipo, lead)) titulo.value = taskTitleFor(tp, lead);
        const s = suggestedTaskDue(tp, lead); if (s && !due.value) due.value = toLocalInput(s);
        tipo = tp; paint();
      });
      pills.append(b);
    }
    paint();

    const descricao = h("textarea", { class: "floow-input floow-textarea", placeholder: "Descrição (opcional)" }) as HTMLTextAreaElement;
    const assignee = assigneeSelect(member.name);
    const recorrente = recorrenteCheck();

    const ok = h("button", { class: "floow-btn floow-btn-primary", style: "margin-top:6px" }, ["Criar tarefa"]);
    ok.addEventListener("click", async () => {
      if (!titulo.value.trim()) { api.setError("Título obrigatório."); return; }
      if (!due.value) { api.setError("Defina o prazo."); return; }
      const { error } = await supabase.from("tasks").insert({
        lead_id: lead.id, titulo: titulo.value.trim(), descricao: descricao.value.trim() || null, due_at: new Date(due.value).toISOString(),
        assignee: assignee.value, notify: true, tipo, created_by: member.name,
        recorrente: recorrente.input.checked,
      });
      if (error) { api.setError(error.message); return; }
      flash("Tarefa criada ✓");
      api.done(null);
    });
    const skip = h("button", { class: "floow-btn", style: "margin-top:6px" }, ["Pular"]);
    skip.addEventListener("click", () => api.done(null));

    wrap.append(h("div", { class: "floow-qlabel" }, ["Tipo"]), pills, titulo, descricao, due,
      h("div", { class: "floow-qlabel" }, ["Responsável pela tarefa"]), assignee, recorrente.label, ok, skip);
    return wrap;
  });
}

// Botão de copiar uma mensagem pronta.
function copyMsgBtn(label: string, msg: string): HTMLElement {
  const b = h("button", { class: "floow-btn floow-wa", style: "width:100%;margin-bottom:6px" }, [label]) as HTMLButtonElement;
  b.addEventListener("click", async () => {
    try { await navigator.clipboard.writeText(msg); const o = b.textContent; b.textContent = "Copiado ✓"; setTimeout(() => (b.textContent = o), 1500); } catch { /* copiar na mão */ }
  });
  return b;
}
// Botões de mensagem conforme o tipo da tarefa + o lead.
function msgButtonsFor(tipo: string, lead: Lead | null): HTMLElement[] {
  if (!lead) return [];
  if (tipo === "lembrete_reuniao") return [
    copyMsgBtn("📋 Copiar confirmação", msgConfirmacao(lead.nome, lead.data_agendamento)),
    copyMsgBtn("📋 Copiar lembrete", msgLembrete(lead.nome, lead.data_agendamento, lead.local)),
  ];
  if (tipo === "follow_up") return [copyMsgBtn("📋 Copiar proposta", msgProposta(lead.empresa || lead.nome))];
  return [];
}

// Nomes que podem ser responsáveis por uma tarefa (eu + SDRs + Closers).
function assigneeNames(): string[] {
  const s = new Set<string>();
  if (member.name) s.add(member.name);
  for (const x of sdrs) s.add(x.name);
  for (const x of closers) s.add(x.name);
  return [...s];
}
function assigneeSelect(current: string | null): HTMLSelectElement {
  const sel = h("select", { class: "floow-input" }) as HTMLSelectElement;
  const names = assigneeNames();
  if (current && !names.includes(current)) names.unshift(current);
  for (const n of names) { const o = h("option", { value: n }, [n]) as HTMLOptionElement; if (n === current) o.selected = true; sel.append(o); }
  return sel;
}

// Editar uma tarefa já criada (título/prazo/tipo/responsável) + copiar as mensagens + concluir/excluir.
function editTaskModal(task: { id: string; titulo: string; descricao?: string | null; due_at: string | null; tipo: string; assignee?: string | null; lead_id?: string | null; recorrente?: boolean }, lead: Lead | null): Promise<null> {
  return openModal<null>("Editar tarefa", (api) => {
    let tipo = task.tipo || "outro";
    const wrap = h("div", {});
    const msgArea = h("div", {});
    const renderMsgs = () => { msgArea.replaceChildren(...msgButtonsFor(tipo, lead)); };

    const titulo = h("input", { class: "floow-input" }) as HTMLInputElement; titulo.value = task.titulo;
    const descricao = h("textarea", { class: "floow-input floow-textarea", placeholder: "Descrição (opcional)" }) as HTMLTextAreaElement;
    descricao.value = task.descricao ?? "";
    const due = h("input", { class: "floow-input", type: "datetime-local", style: "color-scheme:dark" }) as HTMLInputElement;
    if (task.due_at) due.value = toLocalInput(task.due_at);
    const assignee = assigneeSelect(task.assignee ?? member.name);
    const recorrente = recorrenteCheck(!!task.recorrente);

    const pills = h("div", { class: "floow-pills", style: "margin-bottom:8px" });
    const paint = () => pills.querySelectorAll(".floow-pill").forEach((el) => {
      const on = (el as HTMLElement).dataset.tipo === tipo;
      (el as HTMLElement).style.cssText = on ? `border-color:${TASK_TIPO_COLORS[tipo]}88;background:${TASK_TIPO_COLORS[tipo]}22;color:${TASK_TIPO_COLORS[tipo]}` : "";
    });
    for (const tp of TASK_TIPO_OPTIONS) {
      const b = h("button", { class: "floow-pill", "data-tipo": tp }, [`${TASK_TIPO_ICONS[tp]} ${TASK_TIPO_LABELS[tp]}`]);
      b.addEventListener("click", () => { tipo = tp; paint(); renderMsgs(); });
      pills.append(b);
    }
    paint(); renderMsgs();

    const save = h("button", { class: "floow-btn floow-btn-primary", style: "margin-top:6px" }, ["Salvar"]);
    save.addEventListener("click", async () => {
      if (!titulo.value.trim()) { api.setError("Título obrigatório."); return; }
      const { error } = await supabase.from("tasks").update({ titulo: titulo.value.trim(), descricao: descricao.value.trim() || null, tipo, assignee: assignee.value, due_at: due.value ? new Date(due.value).toISOString() : null, recorrente: recorrente.input.checked }).eq("id", task.id);
      if (error) { api.setError(error.message); return; }
      flash("Tarefa atualizada ✓"); api.done(null);
    });
    const done = h("button", { class: "floow-btn", style: "margin-top:6px" }, ["✓ Concluir"]);
    done.addEventListener("click", async () => {
      const ok = await concluirTarefa({ ...task, descricao: descricao.value.trim() || null, recorrente: recorrente.input.checked, lead_id: task.lead_id ?? lead?.id ?? null, due_at: due.value ? new Date(due.value).toISOString() : task.due_at, tipo, assignee: assignee.value });
      if (ok) { flash("Tarefa concluída ✓"); api.done(null); }
    });
    const del = h("button", { class: "floow-btn", style: "margin-top:6px;color:#fb7185" }, ["Excluir"]);
    del.addEventListener("click", async () => { if (!confirm("Excluir esta tarefa?")) return; await supabase.from("tasks").delete().eq("id", task.id); flash("Tarefa excluída"); api.done(null); });

    // Botão pra ir direto na conversa do lead — funciona mesmo se o lead não está
    // no cache (busca pelo lead_id). Fica no topo, verde, pra facilitar a navegação.
    let convBtn: Node = document.createTextNode("");
    if (task.lead_id || lead) {
      const conv = h("button", { class: "floow-btn floow-wa", style: "margin-bottom:8px" });
      conv.innerHTML =
        '<svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2a10 10 0 00-8.6 15l-1.3 4.8 4.9-1.3A10 10 0 1012 2zm5.9 14.2c-.2.7-1.4 1.3-2 1.4-.5.1-1.2.1-1.9-.1-.4-.1-1-.3-1.7-.6-3-1.3-4.9-4.3-5-4.5-.2-.2-1.2-1.6-1.2-3s.7-2.1 1-2.4c.2-.3.5-.4.7-.4h.5c.2 0 .4 0 .6.5l.8 2c.1.2.1.3 0 .5l-.4.6-.3.3c-.2.2-.3.4-.1.7.2.3.9 1.4 1.9 2.3 1.3 1.1 2.3 1.5 2.6 1.6.3.1.5.1.7-.1l.8-1c.2-.2.4-.2.6-.1l2 1c.3.1.5.2.5.3.1.2.1.8-.1 1.3z"/></svg>' +
        "<span>💬 Abrir conversa no WhatsApp</span>";
      conv.addEventListener("click", async () => {
        let l: Lead | null = lead;
        if (!l && task.lead_id) {
          l = leads.find((x) => x.id === task.lead_id) ?? null;
          if (!l) { const { data } = await supabase.from("leads").select(LEAD_COLUMNS).eq("id", task.lead_id).single(); l = (data as Lead) ?? null; }
        }
        if (!l) { flash("Lead não encontrado."); return; }
        api.done(null);
        openConversation(l);
      });
      convBtn = conv;
    }

    wrap.append(convBtn, msgArea, h("div", { class: "floow-qlabel" }, ["Tipo"]), pills, titulo, descricao, due,
      h("div", { class: "floow-qlabel" }, ["Responsável"]), assignee, recorrente.label, save, done, del);
    return wrap;
  });
}

// ============================================================
// Novo lead (cria direto da conversa, com dedup + regras por etapa)
// ============================================================
type CreateResult =
  | { existing: Lead }
  | { nome: string; tel: string; insta: string; fonte: string | null; stage: LeadStatus }
  | null;

function openCreateForm(prefill: { nome: string; tel: string }): Promise<CreateResult> {
  return openModal<CreateResult>("Novo lead", (api) => {
    const wrap = h("div", {});
    const nomeIn = h("input", { class: "floow-input", placeholder: "Nome / empresa *" }) as HTMLInputElement;
    nomeIn.value = prefill.nome;
    const telIn = h("input", { class: "floow-input", placeholder: "WhatsApp *", inputmode: "tel" }) as HTMLInputElement;
    telIn.value = prefill.tel;
    const instaIn = h("input", { class: "floow-input", placeholder: "Instagram (opcional)" }) as HTMLInputElement;

    // Origem (fonte)
    let selFonte: string | null = null;
    const fontePills = h("div", { class: "floow-pills" });
    for (const f of FONTE_OPTIONS) {
      const b = h("button", { class: "floow-pill" }, [FONTE_LABELS[f]]);
      b.addEventListener("click", () => { selFonte = selFonte === f ? null : f; fontePills.querySelectorAll(".floow-pill").forEach((x) => x.classList.remove("sel")); if (selFonte) b.classList.add("sel"); });
      fontePills.append(b);
    }

    // Etapa (só as que o usuário pode criar)
    let selStage: LeadStatus = "qualificado";
    const stagePills = h("div", { class: "floow-pills" });
    for (const s of STATUS_ORDER) {
      if (!canMoveTo(s, member)) continue;
      const b = h("button", { class: "floow-pill" + (s === selStage ? " sel" : ""), "data-s": s }, [STATUS_LABELS[s]]);
      b.addEventListener("click", () => { selStage = s; stagePills.querySelectorAll(".floow-pill").forEach((x) => x.classList.remove("sel")); b.classList.add("sel"); });
      stagePills.append(b);
    }

    const confirm = h("button", { class: "floow-btn floow-btn-primary", style: "margin-top:10px" }, ["Criar lead"]);
    confirm.addEventListener("click", () => {
      const nome = nomeIn.value.trim();
      const tel = telIn.value.trim();
      const insta = instaIn.value.trim().replace(/^@/, "");
      if (!nome || !tel) { api.setError("Nome e WhatsApp são obrigatórios."); return; }
      // Dedup: telefone OU instagram já existente.
      const dup = findDup(tel, insta);
      if (dup) { api.done({ existing: dup }); return; }
      api.done({ nome, tel, insta, fonte: selFonte, stage: selStage });
    });

    wrap.append(
      h("div", { class: "floow-qlabel" }, ["Nome *"]), nomeIn,
      h("div", { class: "floow-qlabel" }, ["WhatsApp *"]), telIn,
      h("div", { class: "floow-qlabel" }, ["Instagram"]), instaIn,
      h("div", { class: "floow-qlabel" }, ["Origem"]), fontePills,
      h("div", { class: "floow-qlabel", style: "margin-top:10px" }, ["Etapa"]), stagePills,
      confirm,
    );
    return wrap;
  });
}

// Dedup contra o cache `leads`: mesmo telefone (normalizado) OU mesmo instagram.
function findDup(tel: string, insta: string): Lead | undefined {
  const i = (insta || "").trim().toLowerCase().replace(/^@/, "");
  return leads.find((x) =>
    samePhone(x.telefone, tel) ||
    (!!i && (x.instagram || "").toLowerCase().replace(/^@/, "") === i),
  );
}

async function beginCreate() {
  // Recarrega os leads do banco ANTES de tudo: o cache em memória pode estar velho
  // (realtime perdeu o INSERT), e é isso que fazia a extensão não linkar o lead que
  // já existe E deixar criar duplicata. Com o cache fresco, o dedup enxerga tudo.
  await loadLeads();

  const detPhone = readActiveChatPhone();
  const detTitle = readActiveChatTitle();

  // Se o telefone da conversa já é um lead, linka e nem abre o formulário.
  if (detPhone) {
    const already = findDup(detPhone, "");
    if (already) {
      currentLeadId = already.id;
      matchInfo = "já existe no CRM";
      render();
      flash(`Já é um lead: ${already.empresa || already.nome} ✓`);
      return;
    }
  }
  const prefill = {
    nome: detTitle && !looksLikePhone(detTitle) ? detTitle : "",
    tel: detPhone || (detTitle && looksLikePhone(detTitle) ? detTitle : ""),
  };

  const result = await openCreateForm(prefill);
  if (!result) return;
  if ("existing" in result) {
    currentLeadId = result.existing.id;
    matchInfo = "já existe no CRM";
    render();
    flash(`Já é um lead: ${result.existing.empresa || result.existing.nome} ✓`);
    return;
  }

  const { nome, tel, insta, fonte, stage } = result;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const draft: any = {
    nome, telefone: tel, status: stage,
    instagram: insta || null, fonte: fonte || null,
    origem: "manual", sdr_responsavel: member.name,
  };

  // Info extra conforme a etapa (mesmas regras do funil).
  // Trava 1: info do negócio (Pré qualificado em diante).
  if (BUSINESS_STAGES.includes(stage) && !isPreQualComplete(draft as Lead)) {
    const biz = await askBusinessInfo(draft as Lead); if (!biz) return; Object.assign(draft, biz);
  }
  // Trava 2: qualificação/BANT (Qualificado em diante).
  if (!NO_QUAL_STAGES.includes(stage)) {
    const q = await askQualification(draft); if (!q) return; Object.assign(draft, q);
  }
  if (stage === "negocio_perdido") {
    const m = await askReason("Motivo da perda", MOTIVO_PERDA_LABELS); if (!m) return; draft.motivo_perda = m;
  } else if (stage === "desqualificado") {
    const m = await askReason("Motivo da desqualificação", MOTIVO_DESQUALIFICACAO_PICK); if (!m) return; draft.motivo_desqualificacao = m;
  } else if (stage === "carteira") {
    const m = await askReason("Por que foi pra Carteira?", MOTIVO_CARTEIRA_LABELS); if (!m) return; draft.motivo_carteira = m;
  } else if (stage === "negocio_ganho") {
    const c = await askCreative(draft); if (!c) return; draft.criativo_codigo = c.code; draft.valor = c.valor;
  } else if (stage === "reuniao_agendada") {
    const r = await askCloserDate(draft); if (!r) return; draft.closer_responsavel = r.closer; draft.data_agendamento = r.dataIso; draft.local = r.local as any;
  }

  // Guarda final anti-duplicata: enquanto o SDR preenchia o formulário, o lead pode
  // ter entrado pelo WhatsApp (janela de alguns minutos). Reconsulta o banco e, se já
  // existir, NÃO cria — linka o existente.
  await loadLeads();
  const late = findDup(tel, insta);
  if (late) {
    currentLeadId = late.id;
    matchInfo = "já existe no CRM";
    render();
    flash(`Já é um lead: ${late.empresa || late.nome} ✓ (não dupliquei)`);
    return;
  }

  const { data, error } = await supabase.from("leads").insert(draft).select(LEAD_COLUMNS).single();
  if (error) { flash("Erro ao criar: " + error.message); return; }
  if (data) { leads.unshift(data as Lead); currentLeadId = (data as Lead).id; matchInfo = "criado agora"; }
  render();
  flash("Lead criado ✓");

  if (stage === "reuniao_agendada" && currentLeadId) {
    flash("Sincronizando Google Agenda…");
    const r = await reconcileCalendar(currentLeadId);
    if (r?.ok && r.action === "created") flash("Reunião no Google Agenda ✓");
  }
}

async function doLogout() {
  await supabase.auth.signOut();
  authed = false; leads = []; currentLeadId = null;
  render();
}

// ============================================================
// Dados + realtime
// ============================================================
async function afterAuth() {
  const { data: sess } = await supabase.auth.getSession();
  sessionEmail = sess.session?.user?.email ?? null;
  authed = !!sessionEmail;
  if (!authed) return render();

  const { data: m } = await supabase.from("team_members").select("name,role,is_admin,record_calls").eq("email", sessionEmail).maybeSingle();
  member = {
    name: (m?.name as string) ?? null,
    role: (m?.role as string) ?? null,
    isAdmin: !!m?.is_admin || sessionEmail?.toLowerCase() === ADMIN_EMAIL,
    recordCalls: m?.record_calls !== false, // default: ligado
  };

  const { data: cl } = await supabase.from("team_members").select("id,name").eq("role", "Closer").eq("active", true).order("name");
  // De-duplica por nome (pode haver 2 linhas com o mesmo nome, ex.: Rafe SDR+Closer).
  const seenC = new Set<string>();
  closers = ((cl as { id: string; name: string }[]) ?? []).filter((c) => (seenC.has(c.name) ? false : (seenC.add(c.name), true)));

  const { data: sd } = await supabase.from("team_members").select("id,name").eq("role", "SDR").eq("active", true).order("name");
  // De-duplica por nome (pode haver 2 linhas com o mesmo nome).
  const seenS = new Set<string>();
  sdrs = ((sd as { id: string; name: string }[]) ?? []).filter((s) => (seenS.has(s.name) ? false : (seenS.add(s.name), true)));

  const { data: au } = await supabase.from("audio_snippets").select("id,name,urls,emoji,active,ordem,owner").eq("active", true).order("ordem");
  // Só os áudios "de todos" (owner null) + os do próprio SDR logado.
  audios = ((au as AudioSnippet[]) ?? []).filter((a) => !a.owner || a.owner === member.name);

  // Mensagens prontas (texto ou vídeo) — mesmo filtro por dono.
  const { data: cm } = await supabase.from("canned_messages").select("id,title,content,video_url,owner,ordem,active").eq("active", true).order("ordem");
  cannedMsgs = ((cm as (CannedMessage & { active: boolean })[]) ?? []).filter((m) => !m.owner || m.owner === member.name);

  await loadLeads();
  await loadCallsToday();
  subscribeRealtime();
  startTaskNotifier();
  matchFromChat();

  // Se abriu uma conversa a partir do funil, guarda a etapa pra "voltar ao funil".
  // Restaura TAMBÉM o filtro de responsável do admin (sobrevive ao reload da página).
  try {
    const nav = await chrome.storage.local.get(["floow_nav_stage", "floow_sdr_filter"]);
    returnStage = (nav?.floow_nav_stage as LeadStatus) ?? null;
    sdrFilter = (nav?.floow_sdr_filter as string) || null;
  } catch { returnStage = null; }

  render();
}

async function loadLeads() {
  // Pagina de 1000 em 1000 — o banco corta em 1000 por request. Sem isso, leads
  // antigos (ganhos/perdidos há mais tempo) somem da extensão (não vinculam nem
  // aparecem na busca). Carrega TODOS.
  const all: Lead[] = [];
  const page = 1000;
  for (let from = 0; ; from += page) {
    const { data, error } = await supabase
      .from("leads").select(LEAD_COLUMNS)
      // Ordena por CREATED_AT (imutável) + id como desempate. Antes ordenava por
      // updated_at, que MUDA (temperatura/edições) durante a paginação e fazia um
      // lead cair em 2 páginas → duplicava na extensão. created_at é estável.
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .range(from, from + page - 1);
    if (error || !data || data.length === 0) break;
    all.push(...(data as Lead[]));
    if (data.length < page) break;
  }
  // Rede de segurança: dedup por id (caso algo ainda escape).
  const seen = new Set<string>();
  leads = all.filter((l) => (seen.has(l.id) ? false : (seen.add(l.id), true)));
}

let channelStarted = false;
function subscribeRealtime() {
  if (channelStarted) return;
  channelStarted = true;
  supabase
    .channel("floow-ext-leads")
    .on("postgres_changes", { event: "*", schema: "public", table: "leads" }, (payload) => {
      const row = (payload.new ?? {}) as Lead;
      if (payload.eventType === "DELETE") {
        const oldId = (payload.old as { id?: string })?.id;
        leads = leads.filter((l) => l.id !== oldId);
      } else if (row.id) {
        const i = leads.findIndex((l) => l.id === row.id);
        const prev = i >= 0 ? leads[i] : undefined;
        if (i >= 0) leads[i] = { ...leads[i], ...row }; else leads.unshift(row);
        maybeNotifyLead(payload.eventType, row, prev);
      }
      if (!collapsed && !searchMode && !document.querySelector(".floow-modal")) render();
    })
    .subscribe((status) => setConn(status === "SUBSCRIBED" ? "on" : "off"));
}

// ============================================================
// Vínculo com a conversa aberta
// ============================================================
// Normaliza nome pra comparar: minúsculas, sem acento/pontuação, espaços únicos.
function normName(s: string): string {
  return (s || "")
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Match por nome — RÍGIDO pra não casar errado. O nome salvo no WhatsApp costuma
// ter "extras" (ex.: "Jailton Antonio | #75 Eridenim") e diferir do CRM ("Jailton
// Antonio Silva" / empresa "Eri Denim"). Regras (só casa por PALAVRA INTEIRA, nunca
// por pedaço solto — senão um lead "M" casa com "conta coMercial"):
//   (a) empresa sem espaços (>=4) contida no título;
//   (b) nome (>=3) igual ao título OU é uma palavra inteira do título;
//   (c) 2+ palavras (>=3 letras) do nome presentes como palavra inteira no título.
function findByName(title: string): Lead | undefined {
  const t = normName(title);
  if (t.length < 3) return undefined; // título curto demais pra confiar
  const tWords = t.split(" ").filter(Boolean);
  const tNoSpace = t.replace(/\s/g, "");

  // (1) HANDLE do negócio (empresa OU @instagram, sem espaços) casado com o título.
  //     Casa nos DOIS sentidos: handle dentro do título, OU título dentro do handle.
  //     O 2º caso cobre @handle com sufixo — ex.: título "Planeta Infantil" (15) está
  //     DENTRO de "planetainfantil.oficial" (21). Antes só checava handle⊂título e, se o
  //     WhatsApp não entregava o telefone, o lead "não abria" (bug intermitente).
  //     Sinal FORTE e específico (evita homônimo por nome; bug "Karla").
  for (const lead of leads) {
    for (const raw of [lead.empresa, lead.instagram]) {
      const e = normName(raw || "").replace(/\s/g, "");
      if (e.length < 4) continue;
      if (tNoSpace.includes(e)) return lead;                                       // handle ⊂ título
      if (e.length >= 5 && tNoSpace.length >= 5 && e.includes(tNoSpace)) return lead; // título ⊂ handle
    }
  }
  // (2) NOME COMPLETO idêntico ao título — só aceita se for ÚNICO. Se houver mais de
  //     um lead com esse nome exato, é ambíguo → não adivinha.
  const exact = leads.filter((l) => { const n = normName(l.nome); return n.length >= 3 && n === t; });
  if (exact.length === 1) return exact[0];
  // (3) 2+ palavras (>=3 letras) do nome presentes no título — sinal razoável; único.
  const multi = leads.filter((l) => {
    const words = normName(l.nome).split(" ").filter((w) => w.length >= 3);
    return words.length >= 2 && words.filter((w) => tWords.includes(w)).length >= 2;
  });
  if (multi.length === 1) return multi[0];
  // (4) UMA palavra do nome dentro do título (ex.: só "luana") — sinal FRACO. Só casa
  //     se houver EXATAMENTE UM lead com esse nome. Com vários homônimos NÃO adivinha
  //     (era o bug: abria a "Luana" desqualificada da Celine no lugar da venda).
  const weak = leads.filter((l) => { const n = normName(l.nome); return n.length >= 3 && tWords.includes(n); });
  if (weak.length === 1) return weak[0];
  return undefined;
}

function matchFromChat() {
  const phone = readActiveChatPhone();
  const title = readActiveChatTitle();
  lastPhone = phone;
  lastTitle = title || (phone ? `+${phone}` : null);

  let l: Lead | undefined;
  if (phone) {
    // (0) @lid aprendido de contato SALVO (forte): a conversa mostra o @lid.
    l = leads.find((x) => x.wa_lid && samePhone(x.wa_lid, phone));
    if (l) matchInfo = "por contato vinculado";
    // (1) telefone da conversa (contato não salvo).
    if (!l) { l = leads.find((x) => samePhone(x.telefone, phone)); if (l) matchInfo = "por telefone (conversa)"; }
  }
  if (!l && title && looksLikePhone(title)) {
    l = leads.find((x) => samePhone(x.telefone, title));
    if (l) matchInfo = "por telefone";
  }
  // (2) Nome do contato SALVO (exato) — vinculado antes. Seguro (não é adivinhação).
  if (!l && title) {
    const tt = title.trim();
    l = leads.find((x) => x.wa_contact_name && x.wa_contact_name.trim() === tt);
    if (l) matchInfo = "por contato vinculado";
  }
  if (!l && title) {
    l = findByName(title);
    if (l) matchInfo = "por nome";
  }
  currentLeadId = l?.id ?? null;
  if (!l) matchInfo = "";
}

function startChatWatch() {
  chatTimer = setInterval(() => {
    const key = (readActiveChatPhone() || "") + "|" + (readActiveChatTitle() || "");
    if (key === lastKey) return;
    lastKey = key;
    if (!pinned) matchFromChat(); // fixado (aberto pelo funil) → não troca o lead exibido
    if (authed && !searchMode && !collapsed && !document.querySelector(".floow-modal")) render();
  }, 1000);
}

// ============================================================
// Boot
// ============================================================
// Quando a extensão é atualizada, a aba antiga continua rodando este script com
// o contexto invalidado (chrome.runtime.id some). Isso fazia o auto-refresh do
// Supabase logar "Extension context invalidated" sem parar. O vigia desliga tudo
// assim que detecta — silenciando o script órfão até a aba ser recarregada.
function contextAlive(): boolean {
  try { return !!chrome.runtime?.id; } catch { return false; }
}

function startContextWatch() {
  const w = setInterval(() => {
    if (contextAlive()) return;
    clearInterval(w);
    try { supabase.auth.stopAutoRefresh(); } catch { /* contexto morto */ }
    try { supabase.removeAllChannels(); } catch { /* contexto morto */ }
    if (chatTimer) clearInterval(chatTimer);
  }, 4000);
}

let chatTimer: ReturnType<typeof setInterval> | null = null;

async function boot() {
  mount();
  startChatWatch();
  startContextWatch();
  const { data } = await supabase.auth.getSession();
  if (data.session) await afterAuth();
  else { authed = false; render(); }
}

if (document.body) boot();
else window.addEventListener("DOMContentLoaded", boot);
