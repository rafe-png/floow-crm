// Lê a conversa aberta no WhatsApp Web. O HTML é ofuscado e muda às vezes — por
// isso buscamos o telefone no data-id das mensagens (formato estável
// "<fromMe>_<telefone>@c.us_<msgId>"), com o título do header como apoio/fallback.

// Telefone da conversa aberta (mais confiável: vem do JID das mensagens).
export function readActiveChatPhone(): string | null {
  const main = document.querySelector("#main");
  if (!main) return null;
  // Qualquer elemento de mensagem com data-id serve.
  const nodes = main.querySelectorAll("[data-id]");
  for (const n of Array.from(nodes)) {
    const id = n.getAttribute("data-id") || "";
    const m = id.match(/(\d{8,})@c\.us/); // individual (ignora grupos @g.us)
    if (m) return m[1];
  }
  return null;
}

// Título da conversa aberta: nome do contato (salvo) OU o número (não salvo).
export function readActiveChatTitle(): string | null {
  const main = document.querySelector("#main");
  if (!main) return null;
  const header = main.querySelector("header");
  if (!header) return null;
  const span = header.querySelector("span[title]") as HTMLElement | null;
  const title = span?.getAttribute("title")?.trim();
  return title && title.length > 0 ? title : null;
}
