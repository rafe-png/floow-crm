// Espelho enxuto dos tipos/labels/regras do app (lib/types.ts + kanban). Só o que
// a extensão usa. Mantenha em sincronia se o funil/qualificação mudar.

export type LeadStatus =
  | "qualificado"
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

export type Lead = {
  id: string;
  nome: string;
  empresa: string | null;
  telefone: string;
  status: LeadStatus;
  observacoes: string | null;
  sdr_responsavel: string | null;
  closer_responsavel: string | null;
  fonte: string | null;
  data_agendamento: string | null;
  criativo_codigo: number | null;
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
  updated_at: string;
};

// Colunas que a extensão lê do banco.
export const LEAD_COLUMNS =
  "id,nome,empresa,telefone,status,observacoes,sdr_responsavel,closer_responsavel,fonte,data_agendamento,criativo_codigo,experiencia,situacao,canal_vendas,estoque,historico,estrutura,bant_budget,bant_authority,bant_need,bant_timing,updated_at";

export const STATUS_LABELS: Record<LeadStatus, string> = {
  qualificado: "Entrada",
  em_agendamento: "Qualificado",
  agendando: "Em agendamento",
  reuniao_agendada: "Reunião agendada",
  no_show: "No show",
  follow_up: "Follow-up",
  carteira: "Carteira",
  negocio_ganho: "Negócio ganho",
  negocio_perdido: "Negócio perdido",
  sem_resposta: "Sem resposta",
  desqualificado: "Desqualificado",
};

// Ordem do funil (igual STATUS_ORDER do app).
export const STATUS_ORDER: LeadStatus[] = [
  "qualificado", "em_agendamento", "agendando", "reuniao_agendada", "no_show",
  "follow_up", "carteira", "negocio_ganho", "negocio_perdido", "sem_resposta", "desqualificado",
];

export const STATUS_DOT: Record<LeadStatus, string> = {
  qualificado: "#818cf8",
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
  meta_ads: "Meta Ads", indicacao: "Indicação", outbound: "Outbound", outro: "Outro",
};

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
  decisor: "É o decisor", influenciador: "Influencia", precisa_aprovar: "Precisa aprovar",
};
export const BANT_NEED_LABELS: Record<string, string> = { alta: "Alta", media: "Média", explorando: "Explorando" };
export const BANT_TIMING_LABELS: Record<string, string> = {
  agora: "Quer começar já", "30_dias": "Em 30 dias", "60_90_dias": "60-90 dias", sem_urgencia: "Sem urgência",
};

export const MOTIVO_PERDA_LABELS: Record<string, string> = {
  sem_budget: "Sem budget", sem_timing: "Timing ruim", sem_fit: "Sem fit", concorrente: "Foi pro concorrente",
  nao_decisor: "Não era decisor", sem_retorno: "Sumiu / sem retorno", preco_alto: "Preço alto", outro: "Outro",
};
export const MOTIVO_DESQUALIFICACAO_LABELS: Record<string, string> = {
  nao_e_confeccao: "Não é confecção", muito_pequeno: "Muito pequeno / sem estrutura", sem_verba: "Sem verba pra investir",
  fora_perfil: "Fora do perfil (ICP)", nao_decisor: "Não é o decisor", ja_tem_solucao: "Já tem agência/solução",
  sem_interesse: "Sem interesse real", nao_respondeu: "Não respondeu / sumiu", regiao_fora: "Região/segmento fora do foco", outro: "Outro",
};

// Os 10 campos da qualificação (na ordem do app), pro form completo.
export const QUAL_FIELDS: { key: keyof Lead; label: string; options: Record<string, string> }[] = [
  { key: "experiencia", label: "Experiência", options: EXPERIENCIA_LABELS },
  { key: "situacao", label: "Situação", options: SITUACAO_LABELS },
  { key: "canal_vendas", label: "Canal de vendas", options: CANAL_VENDAS_LABELS },
  { key: "estoque", label: "📦 Estoque", options: ESTOQUE_LABELS },
  { key: "historico", label: "📈 Histórico de tráfego", options: HISTORICO_LABELS },
  { key: "estrutura", label: "👥 Estrutura comercial", options: ESTRUTURA_LABELS },
  { key: "bant_budget", label: "💰 Budget", options: BANT_BUDGET_LABELS },
  { key: "bant_authority", label: "🎯 Authority", options: BANT_AUTHORITY_LABELS },
  { key: "bant_need", label: "🔥 Need", options: BANT_NEED_LABELS },
  { key: "bant_timing", label: "⏱ Timing", options: BANT_TIMING_LABELS },
];

// Etapas que o SDR pode mover (igual SDR_STAGES do app).
export const SDR_STAGES: LeadStatus[] = [
  "qualificado", "em_agendamento", "agendando", "reuniao_agendada", "carteira", "desqualificado", "sem_resposta",
];

// Etapas que NÃO exigem qualificação completa (igual NO_QUAL_STAGES do app).
export const NO_QUAL_STAGES: LeadStatus[] = ["qualificado", "negocio_perdido", "sem_resposta", "desqualificado"];

export function isQualComplete(l: Lead): boolean {
  return !!(
    l.experiencia && l.situacao && l.canal_vendas && l.estoque && l.historico && l.estrutura &&
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

// Mover pra antes da reunião / no-show limpa o agendamento (espelha useLeads).
export function patchForStatus(status: LeadStatus): Record<string, unknown> {
  const patch: Record<string, unknown> = { status };
  if (["qualificado", "em_agendamento", "agendando", "no_show"].includes(status)) {
    patch.data_agendamento = null;
  }
  return patch;
}

// Normaliza telefone pra comparar (só dígitos, com 55, sem o "9" extra do celular).
export function normalizePhone(t: string | null | undefined): string {
  let d = (t ?? "").replace(/\D/g, "").replace(/^55/, "");
  if (d.length === 11 && d[2] === "9") d = d.slice(0, 2) + d.slice(3);
  return d;
}

export function looksLikePhone(s: string): boolean {
  const digits = s.replace(/\D/g, "");
  return digits.length >= 8 && /^[+\d][\d\s().-]+$/.test(s.trim());
}
