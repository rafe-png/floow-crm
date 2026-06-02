export type LeadStatus =
  | "reuniao_agendada"
  | "no_show"
  | "follow_up"
  | "carteira"
  | "negocio_ganho"
  | "negocio_perdido";

export type Owner = "SDR" | "Closer";

// ============================================================
// Qualificação B2B
// ============================================================
export type EstoqueNivel = "muito" | "medio" | "pouco";
export type HistoricoTrafego = "ja_fez" | "fazendo" | "nunca_fez";
export type EstruturaComercial = "2_mais_vendedores" | "1_vendedor" | "dono_vende";

// BANT
export type BantBudget = "tem_verba" | "tem_indefinida" | "nao_tem";
export type BantAuthority = "decisor" | "influenciador" | "precisa_aprovar";
export type BantNeed = "alta" | "media" | "explorando";
export type BantTiming = "agora" | "30_dias" | "60_90_dias" | "sem_urgencia";

// Local da reunião
export type LocalReuniao = "online" | "presencial";

// Motivo da perda do negócio
export type MotivoPerda =
  | "sem_budget"
  | "sem_timing"
  | "sem_fit"
  | "concorrente"
  | "nao_decisor"
  | "sem_retorno"
  | "preco_alto"
  | "outro";

// ============================================================
// Lead
// ============================================================
export type Lead = {
  id: string;
  created_at: string;
  updated_at: string;
  nome: string;
  telefone: string;
  dono: Owner;
  valor: number | null;
  status: LeadStatus;
  observacoes: string | null;

  // Decisor / Empresa
  cargo: string | null;
  empresa: string | null;
  instagram: string | null;

  // Responsáveis (pré-auth: texto livre; pós-auth: auto-preenchido)
  sdr_responsavel: string | null;
  closer_responsavel: string | null;

  // Qualificação
  estoque: EstoqueNivel | null;
  historico: HistoricoTrafego | null;
  estrutura: EstruturaComercial | null;

  // BANT
  bant_budget: BantBudget | null;
  bant_authority: BantAuthority | null;
  bant_need: BantNeed | null;
  bant_timing: BantTiming | null;

  // Agendamento
  data_agendamento: string | null;
  local: LocalReuniao | null;
  meet_link: string | null;
  google_event_id: string | null;
  google_calendar_id: string | null;

  // Perda
  motivo_perda: MotivoPerda | null;

  // Timestamps "fotográficos" (one-shot) usados pras contagens estáveis de meta
  agendado_em: string | null;   // momento que o lead entrou em reuniao_agendada
  ganho_em: string | null;      // momento que o lead virou negocio_ganho
};

export type LeadEventType = "created" | "status_change" | "note";

export type LeadEvent = {
  id: string;
  lead_id: string;
  created_at: string;
  tipo: LeadEventType;
  from_status: LeadStatus | null;
  to_status: LeadStatus | null;
  payload: Record<string, unknown> | null;
};

export type UserGoals = {
  id: string;
  owner: Owner;
  daily_goal: number;
  weekly_goal: number;
  updated_at: string;
};

export type TeamMember = {
  id: string;
  name: string;
  role: Owner;
  email: string | null;
  active: boolean;
  created_at: string;
};

export type Task = {
  id: string;
  lead_id: string | null;
  titulo: string;
  descricao: string | null;
  due_at: string | null;
  done: boolean;
  done_at: string | null;
  assignee: string | null;
  notify: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type NewTaskInput = {
  lead_id?: string | null;
  titulo: string;
  descricao?: string | null;
  due_at?: string | null;
  assignee?: string | null;
  notify?: boolean;
};

// ============================================================
// Constantes de UI
// ============================================================
export const STATUS_ORDER: LeadStatus[] = [
  "reuniao_agendada",
  "no_show",
  "follow_up",
  "carteira",
  "negocio_ganho",
  "negocio_perdido",
];

export const STATUS_LABELS: Record<LeadStatus, string> = {
  reuniao_agendada: "Reunião agendada",
  no_show: "No show",
  follow_up: "Follow-up",
  carteira: "Carteira",
  negocio_ganho: "Negócio ganho",
  negocio_perdido: "Negócio perdido",
};

export const STATUS_COLORS: Record<LeadStatus, { bg: string; text: string; border: string; dot: string }> = {
  reuniao_agendada: { bg: "bg-blue-500/10",    text: "text-blue-300",    border: "border-blue-500/30",    dot: "bg-blue-400" },
  no_show:          { bg: "bg-amber-500/10",   text: "text-amber-300",   border: "border-amber-500/30",   dot: "bg-amber-400" },
  follow_up:        { bg: "bg-violet-500/10",  text: "text-violet-300",  border: "border-violet-500/30",  dot: "bg-violet-400" },
  carteira:         { bg: "bg-cyan-500/10",    text: "text-cyan-300",    border: "border-cyan-500/30",    dot: "bg-cyan-400" },
  negocio_ganho:    { bg: "bg-emerald-500/10", text: "text-emerald-300", border: "border-emerald-500/30", dot: "bg-emerald-400" },
  negocio_perdido:  { bg: "bg-rose-500/10",    text: "text-rose-300",    border: "border-rose-500/30",    dot: "bg-rose-400" },
};

export const ESTOQUE_LABELS: Record<EstoqueNivel, string> = {
  muito: "Muito",
  medio: "Médio",
  pouco: "Pouco",
};

export const HISTORICO_LABELS: Record<HistoricoTrafego, string> = {
  ja_fez: "Já fez tráfego",
  fazendo: "Fazendo tráfego",
  nunca_fez: "Nunca fez",
};

export const ESTRUTURA_LABELS: Record<EstruturaComercial, string> = {
  "2_mais_vendedores": "2+ vendedores",
  "1_vendedor": "1 vendedor dedicado",
  "dono_vende": "Dono que vende",
};

export const BANT_BUDGET_LABELS: Record<BantBudget, string> = {
  tem_verba: "Tem verba definida",
  tem_indefinida: "Tem mas indefinida",
  nao_tem: "Não tem agora",
};

export const BANT_AUTHORITY_LABELS: Record<BantAuthority, string> = {
  decisor: "É o decisor",
  influenciador: "Influencia",
  precisa_aprovar: "Precisa aprovar",
};

export const BANT_NEED_LABELS: Record<BantNeed, string> = {
  alta: "Alta",
  media: "Média",
  explorando: "Explorando",
};

export const BANT_TIMING_LABELS: Record<BantTiming, string> = {
  agora: "Quer começar já",
  "30_dias": "Em 30 dias",
  "60_90_dias": "60-90 dias",
  sem_urgencia: "Sem urgência",
};

export const LOCAL_LABELS: Record<LocalReuniao, string> = {
  online: "Online",
  presencial: "Presencial",
};

export const LOCAL_ICONS: Record<LocalReuniao, string> = {
  online: "💻",
  presencial: "📍",
};

export const MOTIVO_PERDA_LABELS: Record<MotivoPerda, string> = {
  sem_budget: "Sem budget",
  sem_timing: "Timing ruim",
  sem_fit: "Sem fit",
  concorrente: "Foi pro concorrente",
  nao_decisor: "Não era decisor",
  sem_retorno: "Sumiu / sem retorno",
  preco_alto: "Preço alto",
  outro: "Outro",
};

// Cargos comuns em confecções atacadistas (B2B)
export const CARGO_OPTIONS = [
  "Sócio(a)",
  "Dono(a)",
  "Diretor(a)",
  "Gerente comercial",
  "Comprador(a)",
] as const;
export type Cargo = (typeof CARGO_OPTIONS)[number];

// Helper pra montar telefone formatado pra wa.me
export function whatsappLink(telefone: string): string {
  const digits = telefone.replace(/\D/g, "");
  // Se já tem código do país (12+ dígitos), usa direto. Senão, adiciona 55 (Brasil).
  const withCountry = digits.length >= 12 ? digits : `55${digits}`;
  return `https://wa.me/${withCountry}`;
}
