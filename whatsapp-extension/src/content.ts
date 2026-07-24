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
  QUAL_FIELDS,
  CIDADE_ALVO,
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
import { readActiveChatPhone, readActiveChatTitle, readChatDebug } from "./whatsapp";

// ============================================================
// Estado
// ============================================================
let authed = false;
let sessionEmail: string | null = null;
let member: { name: string | null; role: string | null; isAdmin: boolean } = { name: null, role: null, isAdmin: false };
let leads: Lead[] = [];
let closers: { id: string; name: string }[] = [];
let audios: AudioSnippet[] = [];
let currentLeadId: string | null = null;
let matchInfo = "";
let lastPhone: string | null = null;
let collapsed = true;
let searchMode = false;
let lastTitle: string | null = null;
let lastKey = "";

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
  renderLead();
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

function renderLead() {
  const lead = currentLead();

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
  // Número discável pro whatsapp:// (leads @lid não têm número real → sem botão).
  const waDigits = (() => {
    if (!lead.telefone || lead.telefone.includes("@lid")) return null;
    let d = lead.telefone.replace(/\D/g, "");
    if (!d) return null;
    if (d.length <= 11) d = "55" + d.replace(/^55/, "");
    return d;
  })();
  // Botão "Ligar pelo app": abre o app desktop nessa conversa (whatsapp://).
  let waButton: Node = document.createTextNode("");
  if (waDigits) {
    const a = h("a", {
      class: "floow-btn floow-wa",
      href: `whatsapp://send?phone=${waDigits}`,
      title: "Abre o app do WhatsApp nesta conversa (pra ligar)",
    });
    a.innerHTML =
      '<svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">' +
      '<path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z"/></svg>' +
      "<span>Ligar pelo app</span>";
    waButton = a;
  }

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

  body.append(
    h("div", { class: "floow-section" }, [
      h("div", { class: "floow-leadname" }, [lead.empresa || lead.nome]),
      lead.empresa ? h("div", { class: "floow-leadsub" }, [lead.nome]) : document.createTextNode(""),
      h("div", { class: "floow-badge", style: `border-color:${STATUS_DOT[lead.status]}55;color:${STATUS_DOT[lead.status]}` }, [
        h("span", { class: "floow-dot", style: `background:${STATUS_DOT[lead.status]}` }), STATUS_LABELS[lead.status],
      ]),
      h("div", { class: "floow-meta" }, [
        lead.sdr_responsavel ? h("div", {}, [`SDR: ${lead.sdr_responsavel}`]) : document.createTextNode(""),
        lead.closer_responsavel ? h("div", {}, [`Closer: ${lead.closer_responsavel}`]) : document.createTextNode(""),
        fonte ? h("div", {}, [`Origem: ${fonte}`]) : document.createTextNode(""),
        lead.cidade ? h("div", {}, [`📍 ${lead.cidade}${lead.estado ? " · " + lead.estado : ""}`]) : document.createTextNode(""),
        lead.data_agendamento ? h("div", { style: "color:#f5c518" }, [`📅 ${fmtDate(lead.data_agendamento)}`]) : document.createTextNode(""),
      ]),
      igLink,
      matchInfo ? h("div", { class: "floow-hint" }, [`vinculado ${matchInfo}`]) : document.createTextNode(""),
      waButton,
    ]),
  );

  // Áudios prontos (biblioteca) — só se o lead tem número real.
  if (waDigits && audios.length > 0) {
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
    const allowed = active || canMoveTo(s, member);
    const b = h("button", {
      class: `floow-stage${active ? " active" : ""}${!allowed ? " locked" : ""}`,
      style: active ? `border-color:${STATUS_DOT[s]}55;color:${STATUS_DOT[s]}` : "",
      title: !allowed ? "Etapa do Closer — sem permissão" : "",
    }, [h("span", { class: "floow-dot", style: `background:${STATUS_DOT[s]}` }), STATUS_LABELS[s]]);
    if (!active && allowed) b.addEventListener("click", () => beginMove(lead, s));
    grid.append(b);
  }
  body.append(h("div", { class: "floow-section" }, [h("div", { class: "floow-title" }, ["Mover para"]), grid]));

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
    await supabase.from("lead_events").insert({
      lead_id: lead.id, tipo: "note", actor_email: sessionEmail, actor_name: member.name,
      payload: { via: "whatsapp_ext", note: "Observações atualizadas pela extensão" },
    });
    flash("Observações salvas ✓");
  });
  body.append(h("div", { class: "floow-section" }, [h("div", { class: "floow-title" }, ["Observações"]), ta, saveBtn]));

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
  if (lead.cidade) vals.cidade = lead.cidade;
  if (lead.estado) vals.estado = lead.estado;
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
    // Cidade (localização) — pills das cidades-alvo; cada uma já leva a UF.
    const cidadePills = h("div", { class: "floow-pills" });
    for (const c of CIDADE_ALVO) {
      const b = h("button", { class: "floow-pill" + (vals.cidade === c.cidade ? " sel" : "") }, [`${c.cidade} · ${c.uf}`]);
      b.addEventListener("click", () => {
        vals.cidade = c.cidade; vals.estado = c.uf;
        cidadePills.querySelectorAll(".floow-pill").forEach((x) => x.classList.remove("sel"));
        b.classList.add("sel");
      });
      cidadePills.append(b);
    }
    wrap.append(h("div", { class: "floow-qlabel" }, ["📍 Cidade"]), cidadePills);

    const confirm = h("button", { class: "floow-btn floow-btn-primary", style: "margin-top:10px" }, ["Confirmar qualificação"]);
    confirm.addEventListener("click", () => {
      for (const f of QUAL_FIELDS) if (!vals[f.key as string]) { api.setError("Falta: " + f.label); return; }
      if (!vals.cidade || !vals.estado) { api.setError("Falta: Cidade"); return; }
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
    if (!r) return; patch.closer_responsavel = r.closer; patch.data_agendamento = r.dataIso;
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

  const { data: au } = await supabase.from("audio_snippets").select("id,name,urls,emoji,active,ordem,owner").eq("active", true).order("ordem");
  // Só os áudios "de todos" (owner null) + os do próprio SDR logado.
  audios = ((au as AudioSnippet[]) ?? []).filter((a) => !a.owner || a.owner === member.name);

  await loadLeads();
  subscribeRealtime();
  matchFromChat();
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

  for (const lead of leads) {
    const nome = normName(lead.nome);
    const empNoSpace = normName(lead.empresa || "").replace(/\s/g, "");
    if (empNoSpace.length >= 4 && tNoSpace.includes(empNoSpace)) return lead;
    if (nome.length >= 3 && (nome === t || tWords.includes(nome))) return lead;
  }
  for (const lead of leads) {
    const words = normName(lead.nome).split(" ").filter((w) => w.length >= 3);
    if (words.length < 2) continue; // precisa de 2+ palavras significativas
    const hits = words.filter((w) => tWords.includes(w)).length;
    if (hits >= 2) return lead;
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
    matchFromChat();
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
