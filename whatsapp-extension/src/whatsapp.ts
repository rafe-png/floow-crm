// Lê a conversa aberta no WhatsApp Web. O HTML é ofuscado e muda às vezes — por
// isso tentamos várias fontes: o telefone vem do data-id das mensagens (JID
// "<fromMe>_<telefone>@c.us_<msgId>"), com o título do header como apoio.

// Identificador da conversa aberta. Pega o JID das mensagens (dentro do #main):
// pode ser telefone real (@c.us / @s.whatsapp.net) OU um @lid (ID interno que o
// WhatsApp usa por privacidade). O webhook do Z-API salva o MESMO id no lead, então
// casar @lid-com-@lid funciona igual telefone-com-telefone.
export function readActiveChatPhone(): string | null {
  const main = document.querySelector("#main");
  if (!main) return null;
  // Só o data-id das MENSAGENS (contato da conversa aberta). NÃO varremos todos os
  // atributos — isso pegava um JID solto/persistente e vinculava sempre o mesmo lead.
  const RE = /(\d{8,})@(?:c\.us|s\.whatsapp\.net|lid)/;
  let lidFallback: string | null = null;
  for (const n of Array.from(main.querySelectorAll("[data-id]"))) {
    const id = n.getAttribute("data-id") || "";
    const m = id.match(RE);
    if (!m) continue;
    if (id.includes("@lid")) { lidFallback = lidFallback ?? m[1]; continue; }
    return m[1]; // telefone real tem prioridade sobre @lid
  }
  return lidFallback;
}

// Textos do header que NÃO são o nome do contato (status, dicas, rótulos).
// O WhatsApp mostra "online", "digitando…", "visto por último…" logo abaixo do
// nome — sem filtrar, a extensão pegava "online" como se fosse o nome.
const NOT_A_NAME =
  /^(online|digitando|gravando|typing|recording|visto por|last seen|online h|clique para|click here|toque para|tap here|conta comercial|business account|carregando|loading|criptografia|encrypted)/i;

// Título da conversa aberta: nome do contato (salvo) OU o número (não salvo).
export function readActiveChatTitle(): string | null {
  const main = document.querySelector("#main");
  if (!main) return null;
  const header = main.querySelector("header");
  if (!header) return null;

  // Junta os candidatos (spans com title + spans de texto) e devolve o 1º que
  // parece um nome de verdade (não é status/dica).
  const candidates: string[] = [];
  header.querySelectorAll("span[title]").forEach((el) => {
    const t = (el as HTMLElement).getAttribute("title")?.trim();
    if (t) candidates.push(t);
  });
  header.querySelectorAll('span[dir="auto"]').forEach((el) => {
    const t = el.textContent?.trim();
    if (t) candidates.push(t);
  });

  for (const c of candidates) {
    if (c.length >= 2 && !NOT_A_NAME.test(c)) return c;
  }
  return null;
}

// Tenta iniciar a ligação de VOZ nativa do WhatsApp Web (clica no botão do topo
// da conversa). Best-effort: o HTML é ofuscado, então varremos os botões do header
// procurando o de voz (evitando o de vídeo). Retorna true se achou e clicou.
export function startNativeCall(): boolean {
  const header = document.querySelector("#main header");
  if (!header) return false;

  // Candidatos: qualquer coisa clicável com rótulo/ícone.
  const els = Array.from(header.querySelectorAll("[aria-label],[title],[data-icon]"));
  for (const el of els) {
    const label = (
      el.getAttribute("aria-label") ||
      el.getAttribute("title") ||
      el.getAttribute("data-icon") ||
      ""
    ).toLowerCase();
    if (!label) continue;
    if (/v[ií]deo|video/.test(label)) continue; // pula chamada de vídeo
    if (/voz|voice|chamada|call|ligar|phone|audio-call|ptt/.test(label)) {
      const clickable = (el.closest('[role="button"],button,a,div[role="button"]') as HTMLElement) || (el as HTMLElement);
      clickable.click();
      return true;
    }
  }
  return false;
}

// ============================================================
// Abrir uma conversa SEM recarregar o WhatsApp (usa a busca interna).
// Digita o número na caixa de pesquisa, espera o resultado e clica — a SPA do
// WhatsApp abre o chat na hora. Confirma pelo número aberto; se não bater/achar,
// devolve false (o content.ts cai no fallback de recarregar por URL).
// ============================================================
function getSearchBox(): HTMLElement | null {
  const side = document.querySelector("#side");
  if (!side) return null;
  return (
    side.querySelector('div[contenteditable="true"][role="textbox"]') ||
    side.querySelector('div[contenteditable="true"]')
  ) as HTMLElement | null;
}

function typeInSearch(box: HTMLElement, text: string) {
  box.focus();
  try {
    document.execCommand("selectAll", false);
    document.execCommand("delete", false);
    if (text) document.execCommand("insertText", false, text);
  } catch {
    // fallback bruto
    box.textContent = text;
    box.dispatchEvent(new InputEvent("input", { bubbles: true }));
  }
}

function firstResultRow(): HTMLElement | null {
  const pane = document.querySelector("#pane-side");
  if (!pane) return null;
  return (pane.querySelector('[role="listitem"]') || pane.querySelector('[role="row"]')) as HTMLElement | null;
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

function tailMatch(a: string | null, b: string): boolean {
  const da = (a || "").replace(/\D/g, ""); const db = (b || "").replace(/\D/g, "");
  if (da.length < 8 || db.length < 8) return false;
  return da.slice(-8) === db.slice(-8);
}

export async function openWhatsAppChat(digits: string, name: string): Promise<boolean> {
  const box = getSearchBox();
  if (!box) return false;

  const attempt = async (q: string): Promise<boolean> => {
    typeInSearch(box, q);
    for (let i = 0; i < 10; i++) {          // espera o resultado aparecer (~1.8s)
      await wait(180);
      const row = firstResultRow();
      if (row) {
        row.click();
        for (let j = 0; j < 10; j++) {      // confirma que abriu a conversa CERTA
          await wait(150);
          if (tailMatch(readActiveChatPhone(), digits)) return true;
        }
        return false;                        // abriu algo, mas não é o número alvo
      }
    }
    return false;
  };

  let ok = await attempt(digits);
  if (!ok && name && name.trim().length >= 3) ok = await attempt(name.trim());
  typeInSearch(box, "");                      // limpa a busca
  box.blur();
  return ok;
}

// Diagnóstico (mostrado no painel quando não acha o lead).
export function readChatDebug(): { mainFound: boolean; phone: string | null; title: string | null } {
  return { mainFound: !!document.querySelector("#main"), phone: readActiveChatPhone(), title: readActiveChatTitle() };
}
