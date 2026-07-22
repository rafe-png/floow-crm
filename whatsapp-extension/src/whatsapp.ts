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

// Diagnóstico (mostrado no painel quando não acha o lead).
export function readChatDebug(): { mainFound: boolean; phone: string | null; title: string | null } {
  return { mainFound: !!document.querySelector("#main"), phone: readActiveChatPhone(), title: readActiveChatTitle() };
}
