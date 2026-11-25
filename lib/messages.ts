import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { LocalReuniao } from "./types";

function firstName(nome: string | null | undefined): string {
  const n = (nome ?? "").trim();
  return n ? n.split(/\s+/)[0] : "";
}

// Mensagem 1 — confirmação (ao agendar a reunião).
export function msgConfirmacao(nome: string | null | undefined, dataIso: string | null): string {
  const d = dataIso ? new Date(dataIso) : null;
  const dia = d ? format(d, "EEEE", { locale: ptBR }) : "[dia]";
  const data = d ? format(d, "dd/MM") : "xx/xx";
  const hora = d ? format(d, "HH:mm") : "[hora]";
  return `${firstName(nome)}, agendei aqui nossa conversa para ${dia} (${data}) as ${hora} 📆\nNessa conversa vou te mostrar como vamos trazer esses resultados para sua confecção 👇🏼\n\nhttps://floow-cases.vercel.app/`;
}

// Mensagem — proposta (ao mover pra Follow-up). [Marca] = empresa/nome; datas
// preenchidas (proposta = hoje; validade = MESMO DIA da proposta/reunião).
export function msgProposta(marca: string | null | undefined, validadeDias = 0): string {
  const hoje = new Date();
  const validade = new Date(hoje.getTime() + validadeDias * 86_400_000);
  const f = (d: Date) => format(d, "dd/MM/yy");
  const m = (marca ?? "").trim() || "[Marca]";
  return `*Proposta feita | Floow Digital & ${m} | ${f(hoje)}*

O que está incluso:
•  Estruturação estratégica
•  Produção de 3-9 videos criativos
•  Gestão de tráfego pago
•  Implementação de site 100% personalizado
•  Acompanhamento comercial + Planilha
•  Relatórios semanais
•  Suporte diário humanizado

🎁 *Bônus exclusivo:* Implementação de catálogo virtual + manutenção contínua (pelo período contratado, sem custos adicionais)

_(Proposta com o bônus inclusos válida até dia ${f(validade)})_

*Plano semestral: 6x de R$ 1.397*
*Plano trimestral: 3x de R$ 1.597*
*Plano mensal: R$ 1.997*

Vamos iniciar seu projeto? 💛`;
}

// Mensagem — localização do escritório (reunião PRESENCIAL). Enviada pelo botão
// "Localização" do lead. Coordenadas/endereço fixos do escritório da Floow.
export function msgLocalizacao(nome: string | null | undefined): string {
  const n = firstName(nome);
  return `${n ? n + ", a" : "A"}qui está a localização presencial do nosso escritório: https://maps.google.com/maps?q=-7.953316688537598%2C-36.20478439331055&z=17&hl=pt-BR
📍 Fica na rua do Ypiranga, próximo ao restaurante do arrumadinho.`;
}

// Mensagem 2 — lembrete no dia da reunião.
export function msgLembrete(nome: string | null | undefined, dataIso: string | null, local: LocalReuniao | null): string {
  const d = dataIso ? new Date(dataIso) : null;
  const hora = d ? format(d, "HH:mm") : "[hora]";
  const formato = local === "presencial" ? "a localização" : "o link da videochamada";
  return `Oi ${firstName(nome)}, passando rápido só pra lembrar da nossa conversa agendada para hoje as ${hora} 🕢\nDurante o dia te envio alguns lembretes e faltando 15 minutos te envio ${formato}\nAté lá`;
}
