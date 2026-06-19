import { supabase } from "./supabaseClient";
import { APP_URL, ADMIN_EMAIL } from "./config";
import {
  type Lead,
  type LeadStatus,
  STATUS_LABELS,
  STATUS_DOT,
  FONTE_LABELS,
  SAFE_STAGES,
  canMoveTo,
  patchForStatus,
  normalizePhone,
  looksLikePhone,
} from "./crm";
import { readActiveChatTitle } from "./whatsapp";

// ============================================================
// Estado
// ============================================================
let authed = false;
let sessionEmail: string | null = null;
let member: { name: string | null; role: string | null; isAdmin: boolean } = { name: null, role: null, isAdmin: false };
let leads: Lead[] = [];
let currentLeadId: string | null = null;
let matchInfo = "";
let collapsed = true;
let searchMode = false;
let conn: "on" | "off" = "off";
let lastTitle: string | null = null;

// ============================================================
// Helpers de DOM
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
    else if (k.startsWith("on") && typeof v === "function") {
      el.addEventListener(k.slice(2).toLowerCase(), v as EventListener);
    } else if (v != null) el.setAttribute(k, String(v));
  }
  for (const c of children) el.append(c instanceof Node ? c : document.createTextNode(c));
  return el;
}

function currentLead(): Lead | null {
  return leads.find((l) => l.id === currentLeadId) ?? null;
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

  fab = h("button", { id: "floow-fab", title: "floow CRM", onclick: toggle }, ["floow"]);
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
  conn = state;
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
  renderLead();
}

function renderAuth() {
  const email = h("input", { type: "email", placeholder: "E-mail", class: "floow-input" }) as HTMLInputElement;
  const pass = h("input", { type: "password", placeholder: "Senha", class: "floow-input" }) as HTMLInputElement;
  const msg = h("div", { class: "floow-msg" });
  const btn = h("button", { class: "floow-btn floow-btn-primary" }, ["Entrar"]);

  btn.addEventListener("click", async () => {
    btn.textContent = "Entrando…";
    const { error } = await supabase.auth.signInWithPassword({
      email: email.value.trim(),
      password: pass.value,
    });
    if (error) {
      msg.textContent = "Login falhou: " + error.message;
      btn.textContent = "Entrar";
      return;
    }
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
    const res = leads
      .filter((l) =>
        !q ? false :
        (l.nome || "").toLowerCase().includes(q) ||
        (l.empresa || "").toLowerCase().includes(q) ||
        (qd && normalizePhone(l.telefone).includes(qd)),
      )
      .slice(0, 8);
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

function renderLead() {
  const lead = currentLead();

  // Cabeçalho: chat atual + ações
  const top = h("div", { class: "floow-section" }, [
    h("div", { class: "floow-row" }, [
      h("div", { class: "floow-chat" }, [lastTitle ? `Conversa: ${lastTitle}` : "Abra uma conversa"]),
      h("button", { class: "floow-link", onclick: () => { searchMode = true; render(); } }, ["buscar"]),
    ]),
  ]);
  body.append(top);

  if (!lead) {
    body.append(
      h("div", { class: "floow-section floow-empty" }, [
        h("div", { class: "floow-hint" }, [matchInfo || "Nenhum lead vinculado a esta conversa."]),
        h("button", { class: "floow-btn", onclick: () => { searchMode = true; render(); } }, ["Buscar lead manualmente"]),
      ]),
    );
    renderFooter();
    return;
  }

  // Card do lead
  const fonte = lead.fonte ? (FONTE_LABELS[lead.fonte] ?? lead.fonte) : null;
  body.append(
    h("div", { class: "floow-section" }, [
      h("div", { class: "floow-leadname" }, [lead.empresa || lead.nome]),
      lead.empresa ? h("div", { class: "floow-leadsub" }, [lead.nome]) : document.createTextNode(""),
      h("div", { class: "floow-badge", style: `border-color:${STATUS_DOT[lead.status]}55;color:${STATUS_DOT[lead.status]}` }, [
        h("span", { class: "floow-dot", style: `background:${STATUS_DOT[lead.status]}` }),
        STATUS_LABELS[lead.status],
      ]),
      h("div", { class: "floow-meta" }, [
        lead.sdr_responsavel ? h("div", {}, [`SDR: ${lead.sdr_responsavel}`]) : document.createTextNode(""),
        lead.closer_responsavel ? h("div", {}, [`Closer: ${lead.closer_responsavel}`]) : document.createTextNode(""),
        fonte ? h("div", {}, [`Origem: ${fonte}`]) : document.createTextNode(""),
      ]),
      matchInfo ? h("div", { class: "floow-hint" }, [`vinculado ${matchInfo}`]) : document.createTextNode(""),
    ]),
  );

  // Mover etapa (só etapas seguras)
  const grid = h("div", { class: "floow-grid" });
  for (const s of SAFE_STAGES) {
    const active = s === lead.status;
    const allowed = active || canMoveTo(s, member);
    const b = h("button", {
      class: `floow-stage${active ? " active" : ""}${!allowed ? " locked" : ""}`,
      style: active ? `border-color:${STATUS_DOT[s]}55;color:${STATUS_DOT[s]}` : "",
      title: !allowed ? "Sem permissão pra essa etapa" : "",
    }, [h("span", { class: "floow-dot", style: `background:${STATUS_DOT[s]}` }), STATUS_LABELS[s]]);
    if (!active && allowed) b.addEventListener("click", () => moveStatus(lead, s));
    grid.append(b);
  }
  body.append(
    h("div", { class: "floow-section" }, [
      h("div", { class: "floow-title" }, ["Mover para"]),
      grid,
      h("div", { class: "floow-hint" }, ["Reunião, ganho/perdido e desqualificar: faça no app (pedem dados extras)."]),
    ]),
  );

  // Observações
  const ta = h("textarea", { class: "floow-input floow-textarea", placeholder: "Observações…" }) as HTMLTextAreaElement;
  ta.value = lead.observacoes ?? "";
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
    // Registra a alteração no histórico, vinculada ao usuário logado.
    await supabase.from("lead_events").insert({
      lead_id: lead.id,
      tipo: "note",
      actor_email: sessionEmail,
      actor_name: member.name,
      payload: { via: "whatsapp_ext", note: "Observações atualizadas pela extensão" },
    });
    flash("Observações salvas ✓");
  });
  body.append(
    h("div", { class: "floow-section" }, [
      h("div", { class: "floow-title" }, ["Observações"]),
      ta, saveBtn,
    ]),
  );

  renderFooter(lead);
}

function renderFooter(lead?: Lead) {
  body.append(
    h("div", { class: "floow-section floow-footer" }, [
      lead
        ? h("a", { class: "floow-link", href: `${APP_URL}/kanban?lead=${lead.id}`, target: "_blank" }, ["Abrir no app ↗"])
        : h("a", { class: "floow-link", href: `${APP_URL}/kanban`, target: "_blank" }, ["Abrir app ↗"]),
      h("div", { class: "floow-who" }, [
        h("span", { class: "floow-hint" }, [member.name ? `Logado: ${member.name}` : (sessionEmail ?? "")]),
        h("button", { class: "floow-link", onclick: doLogout }, ["sair"]),
      ]),
    ]),
  );
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
// Ações
// ============================================================
async function moveStatus(lead: Lead, status: LeadStatus) {
  const prev = lead.status;
  lead.status = status; // otimista
  render();
  const { error } = await supabase.from("leads").update(patchForStatus(status)).eq("id", lead.id);
  if (error) {
    lead.status = prev;
    render();
    flash("Não foi possível mover: " + error.message);
  } else {
    flash(`Movido para "${STATUS_LABELS[status]}" ✓`);
  }
}

async function doLogout() {
  await supabase.auth.signOut();
  authed = false;
  leads = [];
  currentLeadId = null;
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

  // Papel do usuário (pra travar etapas como no app)
  const { data: m } = await supabase
    .from("team_members")
    .select("name,role,is_admin")
    .eq("email", sessionEmail)
    .maybeSingle();
  member = {
    name: (m?.name as string) ?? null,
    role: (m?.role as string) ?? null,
    isAdmin: !!m?.is_admin || sessionEmail?.toLowerCase() === ADMIN_EMAIL,
  };

  await loadLeads();
  subscribeRealtime();
  matchFromChat(readActiveChatTitle());
  render();
}

async function loadLeads() {
  const { data } = await supabase
    .from("leads")
    .select("id,nome,empresa,telefone,status,observacoes,sdr_responsavel,closer_responsavel,fonte,data_agendamento,updated_at")
    .order("updated_at", { ascending: false });
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
        if (i >= 0) leads[i] = { ...leads[i], ...row };
        else leads.unshift(row);
      }
      if (!collapsed && !searchMode) render();
    })
    .subscribe((status) => setConn(status === "SUBSCRIBED" ? "on" : "off"));
}

// ============================================================
// Vínculo com a conversa aberta
// ============================================================
function matchFromChat(title: string | null) {
  lastTitle = title;
  if (!title) { currentLeadId = null; matchInfo = ""; return; }

  if (looksLikePhone(title)) {
    const norm = normalizePhone(title);
    const l = leads.find((x) => normalizePhone(x.telefone) === norm);
    currentLeadId = l?.id ?? null;
    matchInfo = l ? "por telefone" : "";
    return;
  }
  const t = title.toLowerCase();
  let l = leads.find((x) => (x.nome || "").toLowerCase() === t || (x.empresa || "").toLowerCase() === t);
  if (!l) l = leads.find((x) => (x.nome || "").toLowerCase().includes(t) || (x.empresa || "").toLowerCase().includes(t));
  currentLeadId = l?.id ?? null;
  matchInfo = l ? "por nome" : "";
}

function startChatWatch() {
  setInterval(() => {
    const title = readActiveChatTitle();
    if (title === lastTitle) return;
    matchFromChat(title);
    if (authed && !searchMode && !collapsed) render();
  }, 1000);
}

// ============================================================
// Boot
// ============================================================
async function boot() {
  mount();
  startChatWatch();
  const { data } = await supabase.auth.getSession();
  if (data.session) await afterAuth();
  else { authed = false; render(); }
}

// WhatsApp Web demora a montar; espera o body existir.
if (document.body) boot();
else window.addEventListener("DOMContentLoaded", boot);
