import { supabase } from "./supabaseClient";
import { APP_URL, ADMIN_EMAIL } from "./config";
import {
  type Lead,
  type LeadStatus,
  type AudioSnippet,
  LEAD_COLUMNS,
  STATUS_LABELS,
  STATUS_ORDER,
  STATUS_DOT,
  FONTE_LABELS,
  FONTE_OPTIONS,
  CALL_OUTCOME_LABELS,
  TASK_TIPO_OPTIONS,
  TASK_TIPO_LABELS,
  TASK_TIPO_ICONS,
  TASK_TIPO_COLORS,
  STAGE_TASK_TIPO,
  suggestedTaskDue,
  taskTitleFor,
  QUAL_FIELDS,
  ESTADO_OPTIONS,
  UF_LABELS,
  cidadesForUf,
  SEGMENTO_LABELS,
  SEGMENTO_OPTIONS,
  MOTIVO_PERDA_LABELS,
  MOTIVO_DESQUALIFICACAO_LABELS,
  MOTIVO_CARTEIRA_LABELS,
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
import { readActiveChatPhone, readActiveChatTitle, readChatDebug, startNativeCall, openWhatsAppChat } from "./whatsapp";

// ============================================================
// Estado
// ============================================================
let authed = false;
let sessionEmail: string | null = null;
let member: { name: string | null; role: string | null; isAdmin: boolean } = { name: null, role: null, isAdmin: false };
let leads: Lead[] = [];
let closers: { id: string; name: string }[] = [];
let sdrs: { id: string; name: string }[] = [];
let audios: AudioSnippet[] = [];
let currentLeadId: string | null = null;
let matchInfo = "";
let lastPhone: string | null = null;
let collapsed = true;
let searchMode = false;
let lastTitle: string | null = null;
let lastKey = "";
// Navegação do "funil de vendas" dentro da extensão.
let view: "lead" | "funnel" | "stage" | "tasks" = "lead";
let stageFilter: LeadStatus | null = null;   // etapa cuja lista está aberta
let returnStage: LeadStatus | null = null;    // pra "voltar ao funil" após abrir a conversa
// "Fixado" = lead aberto pelo funil (detalhes), mesmo sem a conversa dele aberta.
// Enquanto fixado, o watcher da conversa NÃO troca o lead exibido.
let pinned = false;

// A conversa aberta é a desse lead? (compara os últimos 8 dígitos)
function chatMatchesLead(lead: Lead): boolean {
  const p = (readActiveChatPhone() || "").replace(/\D/g, "");
  const lp = (lead.telefone || "").replace(/\D/g, "");
  if (p.length < 8 || lp.length < 8) return false;
  return p.slice(-8) === lp.slice(-8);
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

function mount() {
  if (document.getElementById("floow-panel")) return;
  fab = h("button", { id: "floow-fab", title: "floow CRM", onclick: toggle }, ["∞"]);
  connDot = h("span", { id: "floow-conn", class: "off" });
  const header = h("div", { id: "floow-head" }, [
    h("div", { class: "floow-brand" }, [connDot, "floow CRM"]),
    h("button", { class: "floow-x", title: "Fechar", onclick: toggle }, ["×"]),
  ]);
  body = h("div", { id: "floow-body" });
  panel = h("div", { id: "floow-panel", class: "collapsed" }, [header, body]);
  document.body.append(fab, panel);
}

function toggle() {
  collapsed = !collapsed;
  panel.classList.toggle("collapsed", collapsed);
  fab.classList.toggle("hidden", !collapsed);
  if (!collapsed) render();
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
    .select("id,titulo,due_at,tipo,lead_id")
    .eq("done", false)
    .eq("assignee", member.name)
    .lte("due_at", end.toISOString())
    .order("due_at", { ascending: true });
  const rows = (data ?? []) as { id: string; titulo: string; due_at: string | null; tipo: string; lead_id: string | null }[];

  container.replaceChildren();
  if (rows.length === 0) { container.append(h("div", { class: "floow-hint" }, ["Nenhuma tarefa pra hoje. 🎉"])); return; }

  const today0 = new Date(); today0.setHours(0, 0, 0, 0);
  const fmt = (iso: string | null) => {
    if (!iso) return "";
    const d = new Date(iso); const p = (n: number) => String(n).padStart(2, "0");
    return `${p(d.getHours())}:${p(d.getMinutes())}`;
  };

  const groups: { label: string; items: typeof rows }[] = [
    { label: "Atrasadas", items: rows.filter((t) => t.due_at && new Date(t.due_at) < today0) },
    { label: "Hoje", items: rows.filter((t) => !t.due_at || new Date(t.due_at) >= today0) },
  ];
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
        await supabase.from("tasks").update({ done: true }).eq("id", t.id);
        renderTasksAgenda_refresh();
      });
      const row = h("div", { class: "floow-task-row", style: `border-left:3px solid ${color}; cursor:${lead ? "pointer" : "default"}` }, [
        check,
        h("div", { style: "flex:1;min-width:0" }, [
          h("div", { class: "floow-task-title" }, [`${TASK_TIPO_ICONS[t.tipo] || "📌"} ${t.titulo}`]),
          lead ? h("div", { class: "floow-leaditem-sub" }, [lead.empresa || lead.nome || ""]) : document.createTextNode(""),
        ]),
        t.due_at ? h("span", { class: "floow-task-due" }, [fmt(t.due_at)]) : document.createTextNode(""),
      ]);
      if (lead) row.addEventListener("click", () => openConversation(lead));
      wrap.append(row);
    }
    container.append(wrap);
  }
}
// Re-render helper (mantém a view em "tasks").
function renderTasksAgenda_refresh() { if (view === "tasks") render(); }

// Funil = lista de trabalho PESSOAL do SDR: cada um vê só os leads onde é o
// SDR responsável (a origem). NÃO inclui leads de outro SDR onde você é só o
// Closer — senão os leads da Mariana apareceriam pro Rafe (closer). Pra ver
// tudo, use o CRM.
function funnelLeads(): Lead[] {
  const me = member.name;
  if (!me) return [];
  return leads.filter((l) => l.sdr_responsavel === me);
}

// Etapas do funil, com contador de leads em cada uma.
function renderFunnel() {
  const back = h("button", { class: "floow-link" }, ["← Conversa atual"]);
  back.addEventListener("click", () => { view = "lead"; render(); });
  body.append(h("div", { class: "floow-section" }, [
    h("div", { class: "floow-row" }, [h("div", { class: "floow-title" }, ["Funil de vendas"]), back]),
    h("div", { class: "floow-hint", style: "margin-bottom:8px" }, ["Escolha a etapa pra ver os leads."]),
  ]));
  const mine = funnelLeads();
  const grid = h("div", { class: "floow-funnel-grid" });
  for (const s of STATUS_ORDER) {
    const n = mine.filter((l) => l.status === s).length;
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

  const list = funnelLeads()
    .filter((l) => l.status === s)
    .sort((a, b) => (b.updated_at || "").localeCompare(a.updated_at || ""));

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
    const color = callHeat(n);
    // Botão de conversa (só se tem número). Clicar no card = ver detalhes.
    const waBtn = digits
      ? h("button", { class: "floow-leaditem-wa", title: "Abrir conversa no WhatsApp" }, ["💬"])
      : document.createTextNode("");
    if (digits) (waBtn as HTMLElement).addEventListener("click", (e: Event) => { e.stopPropagation(); openConversation(lead); });

    const card = h("div", {
      class: "floow-leaditem",
      style: `border-left:4px solid ${color}; background:${color}14; cursor:pointer;`,
    }, [
      h("div", { class: "floow-leaditem-main" }, [
        h("span", { class: "floow-leaditem-name" }, [lead.empresa || lead.nome || "—"]),
        h("span", { class: "floow-leaditem-sub" }, ["ver detalhes ›"]),
      ]),
      h("span", {
        class: "floow-heatbadge",
        title: `${n} liga${n === 1 ? "ção" : "ções"} hoje`,
        style: `background:${color}22; color:${color}; border:1px solid ${color}66;`,
      }, [`📞 ${n}`]),
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
        h("button", { class: "floow-listitem", onclick: () => { currentLeadId = l.id; searchMode = false; matchInfo = "escolhido na busca"; render(); } }, [
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

// Timestamp da última vez que o botão de ligar não foi encontrado (sinal de que
// o layout do WhatsApp pode ter mudado). Vale por alguns minutos.
let callButtonMissingAt = 0;

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
  if (callButtonMissingAt && Date.now() - callButtonMissingAt < 5 * 60 * 1000) {
    out.push("Não achei o botão de ligar do WhatsApp Web.");
  }
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

  const fonte = lead.fonte ? (FONTE_LABELS[lead.fonte] ?? lead.fonte) : null;
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

  const lockBanner: Node = !editable
    ? h("div", { class: "floow-lock" }, [`🔒 Lead de ${lead.sdr_responsavel || "outro responsável"} — somente leitura`])
    : document.createTextNode("");

  body.append(
    h("div", { class: "floow-section" }, [
      h("div", { class: "floow-leadname" }, [lead.empresa || lead.nome]),
      lead.empresa ? h("div", { class: "floow-leadsub" }, [lead.nome]) : document.createTextNode(""),
      h("div", { class: "floow-badge", style: `border-color:${STATUS_DOT[lead.status]}55;color:${STATUS_DOT[lead.status]}` }, [
        h("span", { class: "floow-dot", style: `background:${STATUS_DOT[lead.status]}` }), STATUS_LABELS[lead.status],
      ]),
      lockBanner,
      h("div", { class: "floow-meta" }, [
        sdrRow,
        lead.closer_responsavel ? h("div", {}, [`Closer: ${lead.closer_responsavel}`]) : document.createTextNode(""),
        fonte ? h("div", {}, [`Origem: ${fonte}`]) : document.createTextNode(""),
        lead.cidade ? h("div", {}, [`📍 ${lead.cidade}${lead.estado ? " · " + lead.estado : ""}`]) : document.createTextNode(""),
        lead.data_agendamento ? h("div", { style: "color:#f5c518" }, [`📅 ${fmtDate(lead.data_agendamento)}`]) : document.createTextNode(""),
      ]),
      igLink,
      matchInfo ? h("div", { class: "floow-hint" }, [`vinculado ${matchInfo}`]) : document.createTextNode(""),
      waButton,
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

// Seção de tarefas do lead: lista os pendentes + formulário pra criar uma nova.
function renderTaskSection(lead: Lead, editable: boolean): Node {
  const sec = h("div", { class: "floow-section" });
  sec.append(h("div", { class: "floow-title" }, ["Tarefas"]));

  const listNode = h("div", { class: "floow-tasklist" }, [h("div", { class: "floow-hint" }, ["carregando…"])]);
  refreshTasks(lead.id, listNode, editable);
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

  const btn = h("button", { class: "floow-btn floow-btn-primary" }, ["Criar tarefa"]) as HTMLButtonElement;
  btn.addEventListener("click", async () => {
    const t = titulo.value.trim();
    if (!t) { flash("Digite o título da tarefa."); return; }
    if (!due.value) { flash("Defina o prazo da tarefa."); return; }
    btn.disabled = true; btn.textContent = "Criando…";
    const { error } = await supabase.from("tasks").insert({
      lead_id: lead.id, titulo: t, due_at: new Date(due.value).toISOString(),
      assignee: member.name, notify: true, tipo, created_by: member.name,
    });
    btn.disabled = false; btn.textContent = "Criar tarefa";
    if (error) { flash("Erro ao criar tarefa: " + error.message); return; }
    flash("Tarefa criada ✓");
    titulo.value = ""; due.value = ""; tipo = "outro"; paint();
    refreshTasks(lead.id, listNode);
  });
  sec.append(pills, titulo, due, btn);
  return sec;
}

// ISO → valor do input datetime-local (respeita o fuso local).
function toLocalInput(iso: string): string {
  const d = new Date(iso); const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

async function refreshTasks(leadId: string, node: HTMLElement, editable = true) {
  const { data } = await supabase
    .from("tasks")
    .select("id,titulo,due_at,done")
    .eq("lead_id", leadId)
    .eq("done", false)
    .order("due_at", { ascending: true, nullsFirst: false });
  node.replaceChildren();
  const rows = (data ?? []) as { id: string; titulo: string; due_at: string | null }[];
  if (rows.length === 0) { node.append(h("div", { class: "floow-hint", style: "margin:0 0 8px" }, ["Nenhuma tarefa pendente."])); return; }
  const fmt = (iso: string) => {
    const d = new Date(iso); const p = (n: number) => String(n).padStart(2, "0");
    return `${p(d.getDate())}/${p(d.getMonth() + 1)} ${p(d.getHours())}:${p(d.getMinutes())}`;
  };
  for (const t of rows) {
    const check = editable
      ? h("button", { class: "floow-task-check", title: "Concluir" }, ["○"])
      : h("span", { class: "floow-task-check", style: "cursor:default" }, ["○"]);
    if (editable) check.addEventListener("click", async () => {
      check.textContent = "…";
      await supabase.from("tasks").update({ done: true }).eq("id", t.id);
      refreshTasks(leadId, node, editable);
    });
    node.append(h("div", { class: "floow-task-row" }, [
      check,
      h("span", { class: "floow-task-title" }, [t.titulo]),
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
      for (const f of QUAL_FIELDS) if (!vals[f.key as string]) { api.setError("Falta: " + f.label); return; }
      api.done({ ...vals });
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

    const confirm = h("button", { class: "floow-btn floow-btn-primary", style: "margin-top:10px" }, ["Confirmar"]);
    confirm.addEventListener("click", () => {
      const n = nome.value.trim(), e = empresa.value.trim(), i = insta.value.trim().replace(/^@/, ""), sg = seg.value;
      if (!n || !e || !i || !sg) { api.setError("Preencha decisor, empresa, Instagram e segmento."); return; }
      if (!uf.value || !cidadeSel.value) { api.setError("Selecione o estado e a cidade."); return; }
      api.done({ nome: n, empresa: e, instagram: i, segmento: sg, estado: uf.value, cidade: cidadeSel.value });
    });

    wrap.append(
      h("div", { class: "floow-qlabel" }, ["Decisor"]), nome,
      h("div", { class: "floow-qlabel" }, ["Empresa"]), empresa,
      h("div", { class: "floow-qlabel" }, ["Instagram"]), insta,
      h("div", { class: "floow-qlabel" }, ["Segmento"]), seg,
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

function askCreative(lead: Lead): Promise<{ code: number | null } | null> {
  return openModal("Código do criativo", (api) => {
    const wrap = h("div", {});
    const input = h("input", { type: "number", min: "1", placeholder: "Ex: 12", class: "floow-input" }) as HTMLInputElement;
    if (lead.criativo_codigo != null) input.value = String(lead.criativo_codigo);
    const ok = h("button", { class: "floow-btn floow-btn-primary" }, ["Confirmar"]);
    ok.addEventListener("click", () => { const v = input.value.trim(); api.done({ code: v ? Number(v) : null }); });
    const skip = h("button", { class: "floow-btn", style: "margin-top:6px" }, ["Sem código"]);
    skip.addEventListener("click", () => api.done({ code: null }));
    wrap.append(h("div", { class: "floow-hint", style: "margin-bottom:8px" }, ["Qual anúncio trouxe esse cliente?"]), input, ok, skip);
    return wrap;
  });
}

function askCloserDate(lead: Lead): Promise<{ closer: string; dataIso: string } | null> {
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
    const dt = h("input", { type: "datetime-local", class: "floow-input" }) as HTMLInputElement;
    if (lead.data_agendamento) {
      const d = new Date(lead.data_agendamento); const p = (n: number) => String(n).padStart(2, "0");
      dt.value = `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
    }
    const ok = h("button", { class: "floow-btn floow-btn-primary", style: "margin-top:10px" }, ["Confirmar reunião"]);
    ok.addEventListener("click", () => {
      if (!sel) { api.setError("Escolha o Closer."); return; }
      if (!dt.value) { api.setError("Escolha data e hora."); return; }
      api.done({ closer: sel, dataIso: new Date(dt.value).toISOString() });
    });
    wrap.append(
      h("div", { class: "floow-qlabel" }, ["Closer responsável *"]), pills,
      h("div", { class: "floow-qlabel", style: "margin-top:10px" }, ["Data e hora *"]), dt, ok,
      h("div", { class: "floow-hint", style: "margin-top:8px" }, ["O evento no Google Agenda é criado/ajustado pelo app."]),
    );
    return wrap;
  });
}

// ============================================================
// Ligações — inicia (best-effort) + registra no histórico do lead
// ============================================================
async function handleCall(lead: Lead, _digits: string) {
  // 1) Inicia a ligação SEMPRE no WhatsApp Web (clica no botão de voz nativo).
  //    NUNCA abrir o app do WhatsApp — a ligação é aqui no Web (decisão fechada).
  const started = startNativeCall();
  if (!started) {
    // Não achou o botão → sinaliza possível quebra do layout (aviso vermelho).
    // O SDR clica no botão de ligar do próprio WhatsApp Web e registra abaixo.
    flash("Não achei o botão de ligar do WhatsApp Web — clique nele manualmente.");
    callButtonMissingAt = Date.now();
    render();
  } else {
    callButtonMissingAt = 0;
  }
  // 2) Pergunta o resultado e registra no histórico do lead.
  const outcome = await askReason("Como foi a ligação?", CALL_OUTCOME_LABELS);
  if (!outcome) return; // cancelou → não registra
  await logCall(lead, outcome);
}

async function logCall(lead: Lead, outcome: string) {
  const { error } = await supabase.from("lead_events").insert({
    lead_id: lead.id,
    tipo: "ligacao",
    actor_email: sessionEmail,
    actor_name: member.name,
    payload: { via: "whatsapp_ext", outcome, by: member.name },
  });
  if (error) { flash("Não registrou a ligação: " + error.message); return; }
  flash(`Ligação registrada (${CALL_OUTCOME_LABELS[outcome] ?? outcome}) ✓`);
  // Conta essa ligação no termômetro do dia (colore o card na hora).
  callsToday.set(lead.id, (callsToday.get(lead.id) ?? 0) + 1);
  // Atualiza o contador na hora.
  const info = panel?.querySelector(".floow-callinfo") as HTMLElement | null;
  if (info) refreshCallHistory(lead.id, info);
}

// Conta as ligações do lead e mostra "📞 N ligações · última: …".
async function refreshCallHistory(leadId: string, node: HTMLElement) {
  const { data, error } = await supabase
    .from("lead_events")
    .select("payload, created_at")
    .eq("lead_id", leadId)
    .eq("tipo", "ligacao")
    .order("created_at", { ascending: false });
  if (error) { node.textContent = ""; return; }
  const rows = data ?? [];
  if (rows.length === 0) { node.textContent = "📞 Nenhuma ligação registrada"; return; }
  const last = rows[0] as { payload?: { outcome?: string }; created_at: string };
  const out = last.payload?.outcome ? (CALL_OUTCOME_LABELS[last.payload.outcome] ?? last.payload.outcome) : "";
  node.textContent = `📞 ${rows.length} ligação${rows.length > 1 ? "ões" : ""}${out ? " · última: " + out : ""}`;
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
    const m = await askReason("Motivo da desqualificação", MOTIVO_DESQUALIFICACAO_LABELS);
    if (!m) return; patch.motivo_desqualificacao = m;
  } else if (target === "carteira") {
    const m = await askReason("Por que foi pra Carteira?", MOTIVO_CARTEIRA_LABELS);
    if (!m) return; patch.motivo_carteira = m;
  } else if (target === "negocio_ganho") {
    const c = await askCreative(lead);
    if (!c) return; patch.criativo_codigo = c.code;
  } else if (target === "reuniao_agendada") {
    const r = await askCloserDate(lead);
    if (!r) return;
    patch.closer_responsavel = r.closer; patch.data_agendamento = r.dataIso;
    patch.agendado_por = member.name; // quem realizou o agendamento
  }

  const { error } = await supabase.from("leads").update(patch).eq("id", lead.id);
  if (error) { flash("Não foi possível: " + error.message); return; }
  Object.assign(lead, patch);
  render();
  flash(`Movido para "${STATUS_LABELS[target]}" ✓`);

  // Sincroniza o Google Agenda: ao agendar (cria/atualiza) ou ao limpar o
  // agendamento de um lead que tinha evento (apaga).
  const clears = ["qualificado", "em_agendamento", "agendando", "no_show"].includes(target);
  if (target === "reuniao_agendada" || (clears && prevEventId)) {
    flash("Sincronizando Google Agenda…");
    const r = await reconcileCalendar(lead.id);
    if (r?.ok && (r.action === "created" || r.action === "updated")) flash("Reunião no Google Agenda ✓");
    else if (r?.ok && r.action === "deleted") flash("Removido do Google Agenda ✓");
    else if (r && !r.ok) flash("Movido ✓ — Google Agenda: " + (r.error || "falhou"));
  }

  // Tarefa sugerida pela etapa (pré-preenchida, pode pular).
  const taskTipo = STAGE_TASK_TIPO[target];
  if (taskTipo) { await openTaskModal(lead, taskTipo); render(); }
}

// Popup de tarefa ao mover no funil (pré-preenchido; fechar = pular).
function openTaskModal(lead: Lead, initialTipo: string): Promise<null> {
  return openModal<null>("Criar tarefa", (api) => {
    let tipo = initialTipo;
    const wrap = h("div", {});
    wrap.append(h("div", { class: "floow-hint", style: "margin-bottom:8px" }, ["Sugerida pela etapa. Edite ou feche pra pular."]));

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

    const ok = h("button", { class: "floow-btn floow-btn-primary", style: "margin-top:6px" }, ["Criar tarefa"]);
    ok.addEventListener("click", async () => {
      if (!titulo.value.trim()) { api.setError("Título obrigatório."); return; }
      if (!due.value) { api.setError("Defina o prazo."); return; }
      const { error } = await supabase.from("tasks").insert({
        lead_id: lead.id, titulo: titulo.value.trim(), due_at: new Date(due.value).toISOString(),
        assignee: member.name, notify: true, tipo, created_by: member.name,
      });
      if (error) { api.setError(error.message); return; }
      flash("Tarefa criada ✓");
      api.done(null);
    });
    const skip = h("button", { class: "floow-btn", style: "margin-top:6px" }, ["Pular"]);
    skip.addEventListener("click", () => api.done(null));

    wrap.append(h("div", { class: "floow-qlabel" }, ["Tipo"]), pills, titulo, due, ok, skip);
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
      const dup = leads.find((x) =>
        samePhone(x.telefone, tel) ||
        (insta && (x.instagram || "").toLowerCase().replace(/^@/, "") === insta.toLowerCase()),
      );
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

async function beginCreate() {
  const detPhone = readActiveChatPhone();
  const detTitle = readActiveChatTitle();
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
    const m = await askReason("Motivo da desqualificação", MOTIVO_DESQUALIFICACAO_LABELS); if (!m) return; draft.motivo_desqualificacao = m;
  } else if (stage === "carteira") {
    const m = await askReason("Por que foi pra Carteira?", MOTIVO_CARTEIRA_LABELS); if (!m) return; draft.motivo_carteira = m;
  } else if (stage === "negocio_ganho") {
    const c = await askCreative(draft); if (!c) return; draft.criativo_codigo = c.code;
  } else if (stage === "reuniao_agendada") {
    const r = await askCloserDate(draft); if (!r) return; draft.closer_responsavel = r.closer; draft.data_agendamento = r.dataIso;
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

  const { data: m } = await supabase.from("team_members").select("name,role,is_admin").eq("email", sessionEmail).maybeSingle();
  member = { name: (m?.name as string) ?? null, role: (m?.role as string) ?? null, isAdmin: !!m?.is_admin || sessionEmail?.toLowerCase() === ADMIN_EMAIL };

  const { data: cl } = await supabase.from("team_members").select("id,name").eq("role", "Closer").eq("active", true).order("name");
  closers = (cl as { id: string; name: string }[]) ?? [];

  const { data: sd } = await supabase.from("team_members").select("id,name").eq("role", "SDR").eq("active", true).order("name");
  // De-duplica por nome (pode haver 2 linhas com o mesmo nome).
  const seenS = new Set<string>();
  sdrs = ((sd as { id: string; name: string }[]) ?? []).filter((s) => (seenS.has(s.name) ? false : (seenS.add(s.name), true)));

  const { data: au } = await supabase.from("audio_snippets").select("id,name,urls,emoji,active,ordem,owner").eq("active", true).order("ordem");
  // Só os áudios "de todos" (owner null) + os do próprio SDR logado.
  audios = ((au as AudioSnippet[]) ?? []).filter((a) => !a.owner || a.owner === member.name);

  await loadLeads();
  await loadCallsToday();
  subscribeRealtime();
  matchFromChat();

  // Se abriu uma conversa a partir do funil, guarda a etapa pra "voltar ao funil".
  try {
    const nav = await chrome.storage.local.get("floow_nav_stage");
    returnStage = (nav?.floow_nav_stage as LeadStatus) ?? null;
  } catch { returnStage = null; }

  render();
}

async function loadLeads() {
  const { data } = await supabase.from("leads").select(LEAD_COLUMNS).order("updated_at", { ascending: false });
  leads = (data as Lead[]) ?? [];
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
        if (i >= 0) leads[i] = { ...leads[i], ...row }; else leads.unshift(row);
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

  // (1) EMPRESA (>=4 sem espaços) contida no título — sinal FORTE. Checa TODOS os
  //     leads ANTES do nome (evita pegar homônimo por nome quando existe a empresa
  //     certa; foi o bug da "Karla" x "Klah Oversized").
  for (const lead of leads) {
    const e = normName(lead.empresa || "").replace(/\s/g, "");
    if (e.length >= 4 && tNoSpace.includes(e)) return lead;
  }
  // (2) NOME idêntico ao título OU palavra inteira do título (1º match).
  for (const lead of leads) {
    const n = normName(lead.nome);
    if (n.length >= 3 && (n === t || tWords.includes(n))) return lead;
  }
  // (3) 2+ palavras (>=3 letras) do nome presentes no título.
  for (const lead of leads) {
    const words = normName(lead.nome).split(" ").filter((w) => w.length >= 3);
    if (words.length >= 2 && words.filter((w) => tWords.includes(w)).length >= 2) return lead;
  }
  return undefined;
}

function matchFromChat() {
  const phone = readActiveChatPhone();
  const title = readActiveChatTitle();
  lastPhone = phone;
  lastTitle = title || (phone ? `+${phone}` : null);

  let l: Lead | undefined;
  if (phone) {
    l = leads.find((x) => samePhone(x.telefone, phone));
    if (l) matchInfo = "por telefone (conversa)";
  }
  if (!l && title && looksLikePhone(title)) {
    l = leads.find((x) => samePhone(x.telefone, title));
    if (l) matchInfo = "por telefone";
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
