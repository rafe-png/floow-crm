// Lê a conversa aberta no WhatsApp Web. O HTML do WhatsApp é ofuscado e muda de
// vez em quando — por isso usamos seletores tolerantes e há sempre a busca manual
// no painel como rede de segurança.

// Título da conversa aberta: nome do contato (salvo) OU o número (não salvo).
export function readActiveChatTitle(): string | null {
  const main = document.querySelector("#main");
  if (!main) return null;
  const header = main.querySelector("header");
  if (!header) return null;

  // O nome/numero costuma estar no primeiro span com atributo title do header.
  const span = header.querySelector("span[title]") as HTMLElement | null;
  const title = span?.getAttribute("title")?.trim();
  return title && title.length > 0 ? title : null;
}
