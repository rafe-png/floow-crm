// Espelho enxuto dos tipos/labels/regras do app (lib/types.ts + kanban). Só o que
// a extensão usa. Mantenha em sincronia se o funil/qualificação mudar.

import cidadesData from "../../lib/data/cidades-br.json";

// Municípios do IBGE por UF (mesmo dataset do app) — pro seletor estado→cidade.
const CIDADES_BR = cidadesData as Record<string, string[]>;
export function cidadesForUf(uf: string | null): string[] {
  return uf ? (CIDADES_BR[uf] ?? []) : [];
}
export const UF_LABELS: Record<string, string> = {
  AC: "Acre", AL: "Alagoas", AP: "Amapá", AM: "Amazonas", BA: "Bahia", CE: "Ceará",
  DF: "Distrito Federal", ES: "Espírito Santo", GO: "Goiás", MA: "Maranhão", MT: "Mato Grosso",
  MS: "Mato Grosso do Sul", MG: "Minas Gerais", PA: "Pará", PB: "Paraíba", PR: "Paraná",
  PE: "Pernambuco", PI: "Piauí", RJ: "Rio de Janeiro", RN: "Rio Grande do Norte",
  RS: "Rio Grande do Sul", RO: "Rondônia", RR: "Roraima", SC: "Santa Catarina",
  SP: "São Paulo", SE: "Sergipe", TO: "Tocantins",
};
export const ESTADO_OPTIONS = Object.keys(UF_LABELS);

export type LeadStatus =
  | "qualificado"
  | "pre_qualificado"
  | "em_agendamento"
  | "agendando"
  | "reuniao_agendada"
  | "no_show"
  | "follow_up"
  | "carteira"
  | "negocio_ganho"
  | "negocio_perdido"
  | "desqualificado"
  | "sem_resposta";

// Áudio "pronto" da biblioteca (enviado pela extensão via Z-API).
export type AudioSnippet = {
  id: string;
  name: string;
  urls: string[];
  emoji: string | null;
  active: boolean;
  ordem: number;
  owner: string | null; // null = todos; senão só aparece pro dono (team_members.name)
};

// Mensagem pronta — na extensão aparece o título. Só texto → COPIA; com vídeo → ENVIA o vídeo.
export type CannedMessage = {
  id: string;
  title: string;
  content: string | null;
  video_url: string | null; // null = mensagem de texto (copia); preenchido = vídeo (envia)
  owner: string | null; // null = todos
  ordem: number;
};

export type Lead = {
  id: string;
  nome: string;
  empresa: string | null;
  instagram: string | null;
  segmento: string | null;
  cidade: string | null;
  estado: string | null;
  telefone: string;
  status: LeadStatus;
  valor: number | null;
  observacoes: string | null;
  sdr_responsavel: string | null;
  closer_responsavel: string | null;
  fonte: string | null;
  prioridade?: boolean; // estrela de prioridade (migração 075) — topo da coluna
  canal: string | null;
  wa_lid: string | null;
  wa_contact_name: string | null;
  data_agendamento: string | null;
  local: string | null;
  agendado_por: string | null;
  google_event_id: string | null;
  criativo_codigo: number | null;
  criativo_codigo_txt: string | null;
  // Qualificação (pra saber se está completa e pré-preencher)
  experiencia: string | null;
  situacao: string | null;
  canal_vendas: string | null;
  estoque: string | null;
  historico: string | null;
  estrutura: string | null;
  bant_budget: string | null;
  bant_authority: string | null;
  bant_need: string | null;
  bant_timing: string | null;
  // Motivo preenchido ao mover pra etapa (desqualificado / perdido / carteira)
  motivo_perda: string | null;
  motivo_desqualificacao: string | null;
  motivo_carteira: string | null;
  updated_at: string;
  created_at?: string | null;
  last_inbound_at?: string | null; // última resposta do lead (temperatura)
};

// Temperatura do lead pela DATA DE ENTRADA no CRM (created_at), em dias. Igual ao CRM
// (redefinido 2026-11-12): <3d Super hot · 3–7d Hot · 7–14d Warm · 14–30d Cold · +30d Frio.
export type LeadTemp = { label: string; color: string; days: number };
export function leadTemperature(lead: { created_at?: string | null }, nowMs: number): LeadTemp {
  const base = new Date(lead.created_at || Date.now()).getTime();
  const days = (nowMs - base) / 86_400_000;
  if (days < 3) return { label: "🔥 Super hot", color: "#ef4444", days };
  if (days < 7) return { label: "🟠 Hot", color: "#f97316", days };
  if (days < 14) return { label: "🟡 Warm", color: "#f59e0b", days };
  if (days < 30) return { label: "🔵 Cold", color: "#0ea5e9", days };
  return { label: "⚪ Frio", color: "#a1a1aa", days };
}

// Colunas que a extensão lê do banco. Usamos "*" de propósito: assim uma coluna
// nova (ex.: wa_lid, wa_contact_name) adicionada por migração NÃO quebra o SELECT
// — se a coluna ainda não existe, ela só não vem (degrada), em vez de derrubar tudo.
export const LEAD_COLUMNS = "*";

export const STATUS_LABELS: Record<LeadStatus, string> = {
  qualificado: "Entrada",
  pre_qualificado: "Pré qualificado",
  em_agendamento: "Qualificado",
  agendando: "Em agendamento",
  reuniao_agendada: "Reunião agendada",
  no_show: "No show",
  follow_up: "Follow-up",
  carteira: "Carteira",
  negocio_ganho: "Negócio ganho",
  negocio_perdido: "Negócio perdido",
  sem_resposta: "Reaquecimento",
  desqualificado: "Desqualificado",
};

// Ordem do funil (igual STATUS_ORDER do app).
export const STATUS_ORDER: LeadStatus[] = [
  "desqualificado", "sem_resposta", "qualificado", "pre_qualificado", "agendando",
  "carteira", "reuniao_agendada", "no_show", "follow_up", "negocio_ganho", "negocio_perdido",
];

export const STATUS_DOT: Record<LeadStatus, string> = {
  qualificado: "#818cf8",
  pre_qualificado: "#c084fc",
  em_agendamento: "#2dd4bf",
  agendando: "#38bdf8",
  reuniao_agendada: "#60a5fa",
  no_show: "#fbbf24",
  follow_up: "#a78bfa",
  carteira: "#22d3ee",
  negocio_ganho: "#34d399",
  negocio_perdido: "#fb7185",
  sem_resposta: "#a1a1aa",
  desqualificado: "#94a3b8",
};

export const FONTE_LABELS: Record<string, string> = {
  meta_ads: "Meta Ads", instagram: "Instagram", indicacao: "Indicação", outbound: "Outbound", outro: "Outro",
};
export const FONTE_OPTIONS = Object.keys(FONTE_LABELS);

// Canal real do lead (ig/wa/fb/mt) — mais específico que a fonte. Usado pra exibir a ORIGEM.
export const CANAL_LABELS: Record<string, string> = {
  ig: "Instagram", wa: "WhatsApp", fb: "Facebook", mt: "Meta Ads", ad: "Meta Ads", meta: "Meta", whatsapp: "WhatsApp", manual: "Manual",
};
// Origem de exibição: prioriza o canal real; cai pra fonte.
export function origemLabel(lead: { canal?: string | null; fonte?: string | null }): string | null {
  if (lead.canal) return CANAL_LABELS[lead.canal] ?? lead.canal;
  if (lead.fonte) return FONTE_LABELS[lead.fonte] ?? lead.fonte;
  return null;
}
// Código do criativo sem o prefixo de canal (MT08 → 08, IG08 → 08). A origem é separada.
export function creativeCodeClean(code: string | null | undefined): string | null {
  if (!code) return null;
  const m = code.toUpperCase().match(/^(IG|WA|FB|MT)-?(.+)$/);
  return m && m[2] ? m[2] : code;
}

// Resultado de uma ligação (registrada no histórico do lead).
export const CALL_OUTCOME_LABELS: Record<string, string> = {
  atendeu: "Atendeu ✅", atendeu_desligou: "Atendeu mas desligou", rejeitou: "Rejeitou", chamou_ate_cair: "Chamou até cair", nao_chamou: "Não chamou",
  // resultados da ligação por telefone (API4COM):
  nao_atendeu: "Não atendeu", caixa_postal: "Caixa postal", ocupado: "Ocupado", ligando: "Ligando…", falhou: "Não completou",
};
export const CALL_OUTCOME_OPTIONS = Object.keys(CALL_OUTCOME_LABELS);

// Opções do popup "Como foi a ligação?" das ligações por TELEFONE (API4COM).
export const CALL_OUTCOME_PHONE_LABELS: Record<string, string> = {
  atendeu: "Atendeu ✅", nao_atendeu: "Não atendeu", caixa_postal: "Caixa postal", ocupado: "Ocupado",
};

// ---- Tarefas tipadas (espelho do app) ----
export type TaskTipo = "qualificar" | "agendar" | "lembrete_reuniao" | "follow_up" | "pos_venda" | "outro";
export const TASK_TIPO_LABELS: Record<string, string> = {
  qualificar: "Qualificar", agendar: "Agendar", lembrete_reuniao: "Lembrete de reunião",
  follow_up: "Follow-up", pos_venda: "Pós-venda", outro: "Outro",
};
export const TASK_TIPO_ICONS: Record<string, string> = {
  qualificar: "🔍", agendar: "📅", lembrete_reuniao: "⏰", follow_up: "🔁", pos_venda: "🎁", outro: "📌",
};
export const TASK_TIPO_COLORS: Record<string, string> = {
  qualificar: "#38bdf8", agendar: "#f5c518", lembrete_reuniao: "#a78bfa", follow_up: "#fb923c", pos_venda: "#34d399", outro: "#71717a",
};
export const TASK_TIPO_OPTIONS = ["qualificar", "agendar", "lembrete_reuniao", "follow_up", "pos_venda"];

export const STAGE_TASK_TIPO: Record<string, string> = {
  qualificado: "qualificar", pre_qualificado: "qualificar",
  em_agendamento: "agendar", agendando: "agendar",
  reuniao_agendada: "lembrete_reuniao", no_show: "follow_up", follow_up: "follow_up",
  negocio_ganho: "pos_venda",
};

// Prazo sugerido (ISO) — só Pós-venda (+7d 9h) e Lembrete (dia da reunião 9h).
export function suggestedTaskDue(tipo: string, lead?: { data_agendamento?: string | null } | null): string | null {
  const at9 = (base: Date) => { const x = new Date(base); x.setHours(9, 0, 0, 0); return x; };
  if (tipo === "pos_venda") { const d = new Date(); d.setDate(d.getDate() + 7); return at9(d).toISOString(); }
  if (tipo === "lembrete_reuniao") { return lead?.data_agendamento ? at9(new Date(lead.data_agendamento)).toISOString() : null; }
  return null;
}
export function taskTitleFor(tipo: string, lead?: { empresa?: string | null; nome?: string | null } | null): string {
  const alvo = lead?.empresa || lead?.nome || "";
  return alvo ? `${TASK_TIPO_LABELS[tipo]} — ${alvo}` : TASK_TIPO_LABELS[tipo];
}

// Cidades-alvo (igual CIDADE_ALVO do app) — cada uma já carrega a UF.
export const CIDADE_ALVO: { cidade: string; uf: string }[] = [
  { cidade: "Santa Cruz do Capibaribe", uf: "PE" },
  { cidade: "Caruaru", uf: "PE" },
  { cidade: "Toritama", uf: "PE" },
  { cidade: "Surubim", uf: "PE" },
  { cidade: "Jataúba", uf: "PE" },
  { cidade: "Taquaritinga do Norte", uf: "PE" },
  { cidade: "Pão de Açúcar", uf: "AL" },
];
export function ufForCidade(cidade: string | null): string | null {
  if (!cidade) return null;
  return CIDADE_ALVO.find((c) => c.cidade.toLowerCase() === cidade.toLowerCase())?.uf ?? null;
}

// ---- Qualificação (mesmas opções do app) ----
export const EXPERIENCIA_LABELS: Record<string, string> = {
  menos_6m: "Menos de 6 meses", "6m_1ano": "6 meses a 1 ano", "1_5anos": "1 a 5 anos", mais_5anos: "+5 anos",
};
export const SITUACAO_LABELS: Record<string, string> = {
  sem_clientes: "Sem clientes", com_sem_demanda: "Com clientes, sem demanda", com_com_demanda: "Com clientes e com demanda",
};
export const CANAL_VENDAS_LABELS: Record<string, string> = {
  box: "Box", loja: "Loja", online: "Somente online",
};
export const ESTOQUE_LABELS: Record<string, string> = { muito: "Muito", medio: "Médio", pouco: "Pouco" };
export const HISTORICO_LABELS: Record<string, string> = {
  ja_fez: "Já fez tráfego", fazendo: "Fazendo tráfego", nunca_fez: "Nunca fez",
};
export const ESTRUTURA_LABELS: Record<string, string> = {
  "2_mais_vendedores": "2+ vendedores", "1_vendedor": "1 vendedor dedicado", dono_vende: "Dono que vende",
};
export const BANT_BUDGET_LABELS: Record<string, string> = {
  tem_verba: "Tem verba definida", tem_indefinida: "Tem mas indefinida", nao_tem: "Não tem agora",
};
export const BANT_AUTHORITY_LABELS: Record<string, string> = {
  decisor: "É o decisor", tem_socio: "Tem sócio",
};
export const BANT_NEED_LABELS: Record<string, string> = { alta: "Alta", media: "Média", explorando: "Explorando" };
export const BANT_TIMING_LABELS: Record<string, string> = {
  agora: "Quer começar já", "30_dias": "Em 30 dias", "60_90_dias": "60-90 dias", sem_urgencia: "Sem urgência",
};

// Motivo preenchido ao mover o lead pra etapa (desqualificado / perdido /
// carteira). Prioriza o da etapa atual; senão mostra o último registrado.
export function motivoDaEtapa(lead: Lead): { titulo: string; texto: string } | null {
  const desq = lead.motivo_desqualificacao
    ? { titulo: "Motivo da desqualificação", texto: MOTIVO_DESQUALIFICACAO_LABELS[lead.motivo_desqualificacao] || lead.motivo_desqualificacao }
    : null;
  const perda = lead.motivo_perda
    ? { titulo: "Motivo da perda", texto: MOTIVO_PERDA_LABELS[lead.motivo_perda] || lead.motivo_perda }
    : null;
  const cart = lead.motivo_carteira
    ? { titulo: "Motivo da carteira", texto: MOTIVO_CARTEIRA_LABELS[lead.motivo_carteira] || lead.motivo_carteira }
    : null;
  if (lead.status === "desqualificado" && desq) return desq;
  if (lead.status === "negocio_perdido" && perda) return perda;
  if (lead.status === "carteira" && cart) return cart;
  return desq || perda || cart || null;
}

export const MOTIVO_PERDA_LABELS: Record<string, string> = {
  sem_budget: "Sem budget", sem_timing: "Timing ruim", sem_fit: "Sem fit", concorrente: "Foi pro concorrente",
  nao_decisor: "Não era decisor", sem_retorno: "Sumiu / sem retorno", preco_alto: "Preço alto", outro: "Outro",
};
// Mapa COMPLETO (exibição do histórico).
export const MOTIVO_DESQUALIFICACAO_LABELS: Record<string, string> = {
  muito_pequeno: "Muito pequeno / sem estrutura", sem_estoque: "Sem estoque", margem_baixa: "Margem muito baixa",
  sem_verba: "Sem budget", revende: "Revende", regiao_fora: "Segmento fora do foco", sem_instagram: "Sem Instagram", sem_fit: "Sem fit",
  // legadas
  nao_e_confeccao: "Não é confecção", fora_perfil: "Fora do perfil (ICP)", nao_decisor: "Não é o decisor",
  ja_tem_solucao: "Já tem agência/solução", sem_interesse: "Sem interesse real", nao_respondeu: "Não respondeu / sumiu", outro: "Outro",
};
// Só as opções ativas (o que aparece no seletor de desqualificar), nesta ordem.
export const MOTIVO_DESQUALIFICACAO_PICK: Record<string, string> = {
  muito_pequeno: "Muito pequeno / sem estrutura", sem_estoque: "Sem estoque", margem_baixa: "Margem muito baixa",
  sem_verba: "Sem budget", revende: "Revende", regiao_fora: "Segmento fora do foco", sem_instagram: "Sem Instagram", sem_fit: "Sem fit",
};

// Os 10 campos da qualificação (na ordem do app), pro form completo.
export const QUAL_FIELDS: { key: keyof Lead; label: string; options: Record<string, string> }[] = [
  { key: "situacao", label: "Situação", options: SITUACAO_LABELS },
  { key: "canal_vendas", label: "Canal de vendas", options: CANAL_VENDAS_LABELS },
  { key: "historico", label: "📈 Histórico de tráfego", options: HISTORICO_LABELS },
  { key: "bant_budget", label: "💰 Budget", options: BANT_BUDGET_LABELS },
  { key: "bant_authority", label: "🎯 Authority", options: BANT_AUTHORITY_LABELS },
  { key: "bant_need", label: "🔥 Need", options: BANT_NEED_LABELS },
  { key: "bant_timing", label: "⏱ Timing", options: BANT_TIMING_LABELS },
  { key: "fonte", label: "📣 Origem", options: FONTE_LABELS },
];

// Etapas que o SDR pode mover (igual SDR_STAGES do app).
export const SDR_STAGES: LeadStatus[] = [
  "qualificado", "pre_qualificado", "em_agendamento", "agendando",
  "carteira", "reuniao_agendada", "no_show", "desqualificado", "sem_resposta",
];

// Etapas que NÃO exigem qualificação completa (igual NO_QUAL_STAGES do app).
// Pré qualificado exige info do negócio (não o BANT).
// Carteira é "estacionamento": não exige qualificação, mas pede o motivo.
export const NO_QUAL_STAGES: LeadStatus[] = ["qualificado", "pre_qualificado", "carteira", "negocio_perdido", "sem_resposta", "desqualificado"];

export const MOTIVO_CARTEIRA_LABELS: Record<string, string> = {
  sem_estoque: "Sem estoque",
  contrato_ativo: "Com contrato ativo",
  sem_urgencia: "Sem urgência",
  sem_verba_agora: "Sem verba agora",
  reestruturando: "Reestruturando a operação",
  aguardando_decisao: "Aguardando decisão interna",
  sazonalidade: "Fora de época (sazonalidade)",
  outro: "Outro",
};

// Segmentos da confecção (igual SEGMENTO_LABELS do app).
export const SEGMENTO_LABELS: Record<string, string> = {
  moda_feminina: "Moda feminina", moda_masculina: "Moda masculina", moda_infantil: "Moda infantil",
  moda_fitness: "Moda fitness", moda_praia: "Moda praia", moda_lingerie: "Moda lingerie",
  moda_jeans: "Moda jeans", moda_intima: "Moda íntima", moda_plus_size: "Moda plus size",
  moda_evangelica: "Moda evangélica", moda_modestia: "Moda modéstia", pijamas: "Pijamas", outro: "Outro",
};
export const SEGMENTO_OPTIONS = Object.keys(SEGMENTO_LABELS);

// Info do negócio (empresa, instagram, decisor, segmento) — obrigatória de
// "Pré qualificado" em diante (igual BUSINESS_STAGES do app).
export const BUSINESS_STAGES: LeadStatus[] = [
  "pre_qualificado", "agendando", "reuniao_agendada", "no_show", "follow_up", "negocio_ganho",
];

export function isPreQualComplete(l: Lead): boolean {
  return !!(l.nome && l.empresa && l.instagram && l.segmento);
}

export function needsBusinessInfo(lead: Lead, target: LeadStatus): boolean {
  return lead.status !== target && BUSINESS_STAGES.includes(target) && !isPreQualComplete(lead);
}

export function isQualComplete(l: Lead): boolean {
  return !!(
    l.fonte && l.estado && l.cidade &&
    l.situacao && l.canal_vendas && l.historico &&
    l.bant_budget && l.bant_authority && l.bant_need && l.bant_timing
  );
}

export function needsQualification(lead: Lead, target: LeadStatus): boolean {
  return lead.status !== target && !NO_QUAL_STAGES.includes(target) && !isQualComplete(lead);
}

export function canMoveTo(
  status: LeadStatus,
  opts: { role: string | null; isAdmin: boolean },
): boolean {
  if (opts.isAdmin) return true;
  if (opts.role === "Closer") return true;
  if (opts.role === "SDR") return SDR_STAGES.includes(status);
  return true;
}

// Sair de "Agendado" sem a reunião acontecer limpa o agendamento INTEIRO
// (data + quem agendou + local). Espelha useLeads.updateLead. NÃO limpa em
// Ganho/Perdido/Follow-up (a reunião aconteceu = histórico).
export function patchForStatus(status: LeadStatus): Record<string, unknown> {
  const patch: Record<string, unknown> = { status };
  if (["qualificado", "pre_qualificado", "em_agendamento", "agendando", "no_show", "desqualificado", "carteira"].includes(status)) {
    patch.data_agendamento = null;
    patch.agendado_por = null;
    patch.local = null;
  }
  return patch;
}

// Normaliza telefone pra comparar (só dígitos, com 55, sem o "9" extra do celular).
export function normalizePhone(t: string | null | undefined): string {
  let d = (t ?? "").replace(/\D/g, "").replace(/^55/, "");
  if (d.length === 11 && d[2] === "9") d = d.slice(0, 2) + d.slice(3);
  return d;
}

// Últimos 8 dígitos (número do assinante) — ignora "9" extra/DDI/formatação.
export function phoneTail(t: string | null | undefined): string {
  const n = normalizePhone(t);
  return n.length >= 8 ? n.slice(-8) : n;
}

// Dois identificadores são "o mesmo": match exato normalizado OU (só pra telefone
// real) mesmos 8 dígitos finais. LIDs (>13 dígitos) só casam EXATO — evita colisão
// dos últimos 8 dígitos entre um LID e um telefone real.
export function samePhone(a: string | null | undefined, b: string | null | undefined): boolean {
  const na = normalizePhone(a), nb = normalizePhone(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  if (na.length > 13 || nb.length > 13) return false; // um dos dois é LID
  const ta = phoneTail(a), tb = phoneTail(b);
  return ta.length >= 8 && ta === tb;
}

export function looksLikePhone(s: string): boolean {
  const digits = s.replace(/\D/g, "");
  return digits.length >= 8 && /^[+\d][\d\s().-]+$/.test(s.trim());
}

// ── Mensagens prontas (agendamento) ───────────────────────────────────────
function firstName(n: string | null | undefined): string {
  const s = (n || "").trim();
  return s ? s.split(/\s+/)[0] : "";
}
export function msgConfirmacao(nome: string | null, dataIso: string | null): string {
  let dia = "[dia]", data = "xx/xx", hora = "[hora]";
  if (dataIso) {
    const d = new Date(dataIso);
    dia = d.toLocaleDateString("pt-BR", { weekday: "long" });
    data = d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
    hora = d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  }
  return `${firstName(nome)}, agendei aqui nossa conversa para ${dia} (${data}) as ${hora} 📆\nNessa conversa vou te mostrar como vamos trazer esses resultados para sua confecção 👇🏼\n\nhttps://floow-cases.vercel.app/`;
}
export function msgLembrete(nome: string | null, dataIso: string | null, local: string | null): string {
  let hora = "[hora]";
  if (dataIso) hora = new Date(dataIso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  const formato = local === "presencial" ? "a localização" : "o link da videochamada";
  return `Oi ${firstName(nome)}, passando rápido só pra lembrar da nossa conversa agendada para hoje as ${hora} 🕢\nDurante o dia te envio alguns lembretes e faltando 15 minutos te envio ${formato}\nAté lá`;
}

export function msgProposta(marca: string | null, validadeDias = 0): string {
  const hoje = new Date();
  const val = new Date(hoje.getTime() + validadeDias * 86400000);
  const f = (d: Date) => d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" });
  const m = (marca || "").trim() || "[Marca]";
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

_(Proposta com o bônus inclusos válida até dia ${f(val)})_

*Plano semestral: 6x de R$ 1.397*
*Plano trimestral: 3x de R$ 1.597*
*Plano mensal: R$ 1.997*

Vamos iniciar seu projeto? 💛`;
}
