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

// Título da conversa aberta: nome do contato (salvo) OU o número (não salvo).
export function readActiveChatTitle(): string | null {
  const main = document.querySelector("#main");
  if (!main) return null;
  const header = main.querySelector("header");
  if (!header) return null;

  const withTitle = header.querySelector("span[title]") as HTMLElement | null;
  const t = withTitle?.getAttribute("title")?.trim();
  if (t) return t;

  // Fallback: texto do primeiro span "auto" do header (nome renderizado).
  const span = header.querySelector('span[dir="auto"]') as HTMLElement | null;
  const txt = span?.textContent?.trim();
  return txt && txt.length > 0 ? txt : null;
}

// Diagnóstico (mostrado no painel quando não acha o lead).
export function readChatDebug(): { mainFound: boolean; phone: string | null; title: string | null } {
  return { mainFound: !!document.querySelector("#main"), phone: readActiveChatPhone(), title: readActiveChatTitle() };
}
