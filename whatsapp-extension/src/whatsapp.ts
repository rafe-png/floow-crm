// Lê a conversa aberta no WhatsApp Web. O HTML é ofuscado e muda às vezes — por
// isso tentamos várias fontes: o telefone vem do data-id das mensagens (JID
// "<fromMe>_<telefone>@c.us_<msgId>"), com o título do header como apoio.

// Telefone da conversa aberta (mais confiável: JID das mensagens DENTRO do #main).
export function readActiveChatPhone(): string | null {
  const main = document.querySelector("#main");
  if (!main) return null;
  // JIDs de telefone real (NÃO @lid, que é um ID interno, não o número).
  const RE = /(\d{8,})@(?:c\.us|s\.whatsapp\.net)/;
  // 1) Mensagens (data-id tem o JID do contato).
  for (const n of Array.from(main.querySelectorAll("[data-id]"))) {
    const m = (n.getAttribute("data-id") || "").match(RE);
    if (m) return m[1];
  }
  // 2) Qualquer atributo dentro do #main que tenha um JID de telefone.
  for (const el of Array.from(main.querySelectorAll<HTMLElement>("*"))) {
    for (const attr of Array.from(el.attributes)) {
      const m = attr.value.match(RE);
      if (m) return m[1];
    }
  }
  return null;
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
