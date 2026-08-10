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

export type Owner = "SDR" | "Closer";

// Papel no time. Owner = papéis de venda (SDR/Closer, têm metas e podem ser
// responsáveis por leads). "Trafego" = gestor de tráfego: não vende, só usa o
// Financeiro. Mantemos Owner separado pra metas/leads continuarem só de venda.
export type TeamRole = Owner | "Trafego";

export const TEAM_ROLE_LABELS: Record<TeamRole, string> = {
  SDR: "SDR",
  Closer: "Closer",
  Trafego: "Gestor de tráfego",
};

// ============================================================
// Papéis / permissões
// ============================================================
// Único admin do CRM (vê o filtro por responsável, gerencia usuários e
// pode mover cards em qualquer etapa do funil).
export const ADMIN_EMAIL = "rafe@floowdigital.com";

export function isAdminEmail(email: string | null | undefined): boolean {
  return !!email && email.toLowerCase() === ADMIN_EMAIL;
}

// Etapas que o SDR trabalha (cor normal, SDR pode mover). Da reunião agendada
// em diante o Closer "pega o bastão": etapas mais escuras e bloqueadas pro SDR.
// Etapas que o SDR pode mover. Inclui "desqualificado"/"sem_resposta" (saída de
// qualificação) e "carteira" (o SDR pode levar leads pra carteira).
// Etapas que o SDR pode mover. Precisa bater com a lista da RLS (migração 036).
export const SDR_STAGES: LeadStatus[] = [
  "qualificado", "pre_qualificado", "em_agendamento", "agendando",
  "carteira", "reuniao_agendada", "no_show", "desqualificado", "sem_resposta",
];

export function canMoveTo(
  status: LeadStatus,
  opts: { role: Owner | null; isAdmin: boolean },
): boolean {
  if (opts.isAdmin) return true;
  if (opts.role === "Closer") return true;
  if (opts.role === "SDR") return SDR_STAGES.includes(status);
  return true; // usuário fora do time (fallback): não trava
}

// ============================================================
// Qualificação B2B
// ============================================================
export type EstoqueNivel = "muito" | "medio" | "pouco";
export type HistoricoTrafego = "ja_fez" | "fazendo" | "nunca_fez";
export type EstruturaComercial = "2_mais_vendedores" | "1_vendedor" | "dono_vende";

// Maturidade / momento da empresa
export type Experiencia = "menos_6m" | "6m_1ano" | "1_5anos" | "mais_5anos";
export type Situacao = "sem_clientes" | "com_sem_demanda" | "com_com_demanda";
export type CanalVendas = "box" | "loja" | "online";

// Segmento da confecção
export type SegmentoConfeccao =
  | "moda_feminina"
  | "moda_masculina"
  | "moda_infantil"
  | "moda_fitness"
  | "moda_praia"
  | "moda_lingerie"
  | "moda_jeans"
  | "moda_intima"
  | "moda_plus_size"
  | "moda_evangelica"
  | "moda_modestia"
  | "pijamas"
  | "outro";

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

// Por que o lead foi pra CARTEIRA (estacionamento: não está pronto agora, mas
// vale recontatar depois). Ao mover pra lá o CRM pede o motivo + uma tarefa.
export type MotivoCarteira =
  | "sem_estoque"
  | "contrato_ativo"
  | "sem_urgencia"
  | "sem_verba_agora"
  | "reestruturando"
  | "aguardando_decisao"
  | "sazonalidade"
  | "outro";

// Por que o lead foi DESqualificado (não vira oportunidade — sai cedo do funil).
export type MotivoDesqualificacao =
  | "nao_e_confeccao"
  | "muito_pequeno"
  | "sem_verba"
  | "fora_perfil"
  | "nao_decisor"
  | "ja_tem_solucao"
  | "sem_interesse"
  | "nao_respondeu"
  | "regiao_fora"
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
  empresa: string | null;
  instagram: string | null;
  segmento: SegmentoConfeccao | null;

  // Localização (mercado-alvo). `cidade` = texto; `estado` = UF (2 letras) usada
  // no mapa de calor dos relatórios. Preenchidos na pré-qualificação.
  cidade: string | null;
  estado: string | null;

  // Responsáveis (pré-auth: texto livre; pós-auth: auto-preenchido)
  sdr_responsavel: string | null;
  closer_responsavel: string | null;

  // Qualificação
  experiencia: Experiencia | null;
  situacao: Situacao | null;
  canal_vendas: CanalVendas | null;
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
  motivo_desqualificacao: MotivoDesqualificacao | null;
  // Por que foi pra Carteira (estacionamento)
  motivo_carteira: MotivoCarteira | null;

  // Timestamps "fotográficos" (one-shot) usados pras contagens estáveis de meta
  agendado_em: string | null;          // momento que o lead entrou em reuniao_agendada
  reuniao_realizada_em: string | null; // momento que saiu de reuniao_agendada p/ ganho/perdido/follow_up
  ganho_em: string | null;             // momento que o lead virou negocio_ganho
  perdido_em: string | null;           // momento que o lead virou negocio_perdido

  // No-show: quantos no-shows SEGUIDOS (zera quando a reunião acontece) + data/hora
  // do último horário furado. Mantidos por trigger no banco.
  no_show_count: number;
  last_no_show_em: string | null;

  // Rastreio de criativo (qual anúncio trouxe o cliente) — preenchido ao ganhar.
  criativo_codigo: number | null;

  // Origem do lead: 'manual' (cadastrado à mão) | 'whatsapp' (entrou pelo anúncio).
  // Uso interno (filtro/roteamento), não confundir com `fonte` (marketing).
  origem: string | null;

  // Fonte de marketing do lead (exibida/selecionável no card). Leads que entram
  // pela automação do WhatsApp já nascem como 'meta_ads'.
  fonte: LeadFonte | null;

  // Produto ofertado ao lead. Obrigatório junto da qualificação. Define o valor
  // sugerido do negócio (PRODUTO_VALORES), que pré-preenche `valor` (editável).
  produto: LeadProduto | null;
};

// De onde o lead veio (canal de marketing).
export type LeadFonte = "meta_ads" | "instagram" | "indicacao" | "outbound" | "outro";

export const FONTE_LABELS: Record<LeadFonte, string> = {
  meta_ads: "Meta Ads",
  instagram: "Instagram",
  indicacao: "Indicação",
  outbound: "Outbound",
  outro: "Outro",
};

export const FONTE_OPTIONS = Object.keys(FONTE_LABELS) as LeadFonte[];

// ============================================================
// Localização — cidades-alvo + estados (UF) pro mapa de calor
// ============================================================

// Estados brasileiros (UF → nome). Usado no seletor "Outra cidade" e no mapa.
export const UF_LABELS: Record<string, string> = {
  AC: "Acre", AL: "Alagoas", AP: "Amapá", AM: "Amazonas", BA: "Bahia",
  CE: "Ceará", DF: "Distrito Federal", ES: "Espírito Santo", GO: "Goiás",
  MA: "Maranhão", MT: "Mato Grosso", MS: "Mato Grosso do Sul", MG: "Minas Gerais",
  PA: "Pará", PB: "Paraíba", PR: "Paraná", PE: "Pernambuco", PI: "Piauí",
  RJ: "Rio de Janeiro", RN: "Rio Grande do Norte", RS: "Rio Grande do Sul",
  RO: "Rondônia", RR: "Roraima", SC: "Santa Catarina", SP: "São Paulo",
  SE: "Sergipe", TO: "Tocantins",
};

export const ESTADO_OPTIONS = Object.keys(UF_LABELS);

// Cidades-alvo pré-configuradas (aparecem no seletor da pré-qualificação).
// Cada uma já carrega a UF certa — é o que alimenta o mapa por estado.
// Pra adicionar novas cidades, é só incluir aqui.
export type CidadeAlvo = { cidade: string; uf: string };
export const CIDADE_ALVO: CidadeAlvo[] = [
  { cidade: "Santa Cruz do Capibaribe", uf: "PE" },
  { cidade: "Caruaru", uf: "PE" },
  { cidade: "Toritama", uf: "PE" },
  { cidade: "Surubim", uf: "PE" },
  { cidade: "Jataúba", uf: "PE" },
  { cidade: "Taquaritinga do Norte", uf: "PE" },
  { cidade: "Pão de Açúcar", uf: "AL" },
];

// Acha a UF de uma cidade-alvo pelo nome (case-insensitive).
export function ufForCidade(cidade: string | null): string | null {
  if (!cidade) return null;
  const hit = CIDADE_ALVO.find((c) => c.cidade.toLowerCase() === cidade.toLowerCase());
  return hit?.uf ?? null;
}

// Produto ofertado (parte da qualificação). Ao selecionar, o "Valor do negócio"
// é pré-preenchido com PRODUTO_VALORES[produto] — mas continua editável.
export type LeadProduto = "aceleracao" | "floow_insta" | "floow_catalogo";

export const PRODUTO_LABELS: Record<LeadProduto, string> = {
  aceleracao: "Programa de Aceleração",
  floow_insta: "Floow Insta",
  floow_catalogo: "Floow Catálogo",
};

// Valor sugerido (R$) por produto — pré-preenche o campo Valor ao selecionar.
export const PRODUTO_VALORES: Record<LeadProduto, number> = {
  aceleracao: 1397,
  floow_insta: 397,
  floow_catalogo: 97,
};

export const PRODUTO_OPTIONS = Object.keys(PRODUTO_LABELS) as LeadProduto[];

export type LeadEventType = "created" | "status_change" | "note" | "ligacao";

// Resultado de uma ligação (registrada pela extensão no histórico do lead).
export type CallOutcome = "atendeu" | "nao_atendeu" | "caixa_postal" | "ocupado";
export const CALL_OUTCOME_LABELS: Record<CallOutcome, string> = {
  atendeu: "Atendeu ✅",
  nao_atendeu: "Não atendeu",
  caixa_postal: "Caixa postal",
  ocupado: "Ocupado",
};

export type LeadEvent = {
  id: string;
  lead_id: string;
  created_at: string;
  tipo: LeadEventType;
  from_status: LeadStatus | null;
  to_status: LeadStatus | null;
  payload: Record<string, unknown> | null;
  // Autoria (migração 031): quem fez a alteração. Null = sistema (webhook).
  actor_email: string | null;
  actor_name: string | null;
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
  role: TeamRole;
  email: string | null;
  active: boolean;
  created_at: string;
  /** Admin do CRM. Vem da coluna is_admin (migração 016); undefined antes dela. */
  is_admin?: boolean;
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

// Investimento em ads lançado pelo gestor de tráfego (por período).
// periodo_inicio/periodo_fim são datas (YYYY-MM-DD), inclusivas.
export type AdInvestment = {
  id: string;
  created_at: string;
  periodo_inicio: string;
  periodo_fim: string;
  valor: number;
  leads_ads: number; // leads/mensagens que os anúncios trouxeram no período (entrada manual)
  canal: string | null;
  created_by: string | null;
};

export type NewAdInvestmentInput = {
  periodo_inicio: string;
  periodo_fim: string;
  valor: number;
  leads_ads: number;
  canal?: string | null;
};

// Gasto diário de anúncios puxado automaticamente da Meta (uma linha por dia).
// Preenchido pela rota /api/meta/sync. O app só lê. Ver migração 033.
export type MetaAdSpendDay = {
  day: string; // "YYYY-MM-DD"
  spend: number;
  leads: number;
  impressions: number;
  clicks: number;
  updated_at: string;
};

// Gasto diário POR CRIATIVO (nível anúncio; código lido do nome do anúncio).
export type MetaCreativeSpendDay = MetaAdSpendDay & { criativo_codigo: number };

// ============================================================
// Constantes de UI
// ============================================================
export const STATUS_ORDER: LeadStatus[] = [
  "desqualificado",
  "sem_resposta",
  "qualificado",      // Entrada
  "pre_qualificado",
  "em_agendamento",   // Qualificado
  "agendando",        // Em agendamento
  "carteira",
  "reuniao_agendada",
  "no_show",
  "follow_up",
  "negocio_ganho",
  "negocio_perdido",
];

// Pipeline ativo = oportunidades em aberto, de "Qualificado" (em_agendamento)
// até "Carteira". Exclui a Entrada (lead só chegou, sem valor/qualificação) e
// as etapas fechadas (ganho, perdido, sem resposta, desqualificado).
export const PIPELINE_STATUSES: LeadStatus[] = [
  "em_agendamento",
  "agendando",
  "reuniao_agendada",
  "no_show",
  "follow_up",
  "carteira",
];

// Nota: os VALORES do enum no banco continuam "qualificado"/"em_agendamento";
// só os rótulos exibidos mudaram (entrada/qualificado). A ordem é preservada,
// então funil, kanban e relatórios seguem corretos.
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
  sem_resposta: "Sem resposta",
  desqualificado: "Desqualificado",
};

export const STATUS_COLORS: Record<LeadStatus, { bg: string; text: string; border: string; dot: string }> = {
  qualificado:      { bg: "bg-indigo-500/10",  text: "text-indigo-300",  border: "border-indigo-500/30",  dot: "bg-indigo-400" },
  pre_qualificado:  { bg: "bg-purple-500/10",  text: "text-purple-300",  border: "border-purple-500/30",  dot: "bg-purple-400" },
  em_agendamento:   { bg: "bg-teal-500/10",    text: "text-teal-300",    border: "border-teal-500/30",    dot: "bg-teal-400" },
  agendando:        { bg: "bg-sky-500/10",     text: "text-sky-300",     border: "border-sky-500/30",     dot: "bg-sky-400" },
  reuniao_agendada: { bg: "bg-blue-500/10",    text: "text-blue-300",    border: "border-blue-500/30",    dot: "bg-blue-400" },
  no_show:          { bg: "bg-amber-500/10",   text: "text-amber-300",   border: "border-amber-500/30",   dot: "bg-amber-400" },
  follow_up:        { bg: "bg-violet-500/10",  text: "text-violet-300",  border: "border-violet-500/30",  dot: "bg-violet-400" },
  carteira:         { bg: "bg-cyan-500/10",    text: "text-cyan-300",    border: "border-cyan-500/30",    dot: "bg-cyan-400" },
  negocio_ganho:    { bg: "bg-emerald-500/10", text: "text-emerald-300", border: "border-emerald-500/30", dot: "bg-emerald-400" },
  negocio_perdido:  { bg: "bg-rose-500/10",    text: "text-rose-300",    border: "border-rose-500/30",    dot: "bg-rose-400" },
  sem_resposta:     { bg: "bg-zinc-500/10",    text: "text-zinc-300",    border: "border-zinc-500/30",    dot: "bg-zinc-400" },
  desqualificado:   { bg: "bg-slate-500/10",   text: "text-slate-300",   border: "border-slate-500/30",   dot: "bg-slate-400" },
};

export const EXPERIENCIA_LABELS: Record<Experiencia, string> = {
  menos_6m: "Menos de 6 meses",
  "6m_1ano": "6 meses a 1 ano",
  "1_5anos": "1 a 5 anos",
  mais_5anos: "+5 anos",
};

export const SITUACAO_LABELS: Record<Situacao, string> = {
  sem_clientes: "Sem clientes",
  com_sem_demanda: "Com clientes, sem demanda",
  com_com_demanda: "Com clientes e com demanda",
};

export const CANAL_VENDAS_LABELS: Record<CanalVendas, string> = {
  box: "Box",
  loja: "Loja",
  online: "Somente online",
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

export const SEGMENTO_LABELS: Record<SegmentoConfeccao, string> = {
  moda_feminina: "Moda feminina",
  moda_masculina: "Moda masculina",
  moda_infantil: "Moda infantil",
  moda_fitness: "Moda fitness",
  moda_praia: "Moda praia",
  moda_lingerie: "Moda lingerie",
  moda_jeans: "Moda jeans",
  moda_intima: "Moda íntima",
  moda_plus_size: "Moda plus size",
  moda_evangelica: "Moda evangélica",
  moda_modestia: "Moda modéstia",
  pijamas: "Pijamas",
  outro: "Outro",
};

export const SEGMENTO_OPTIONS = Object.keys(SEGMENTO_LABELS) as SegmentoConfeccao[];

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

export const MOTIVO_CARTEIRA_LABELS: Record<MotivoCarteira, string> = {
  sem_estoque: "Sem estoque",
  contrato_ativo: "Com contrato ativo",
  sem_urgencia: "Sem urgência",
  sem_verba_agora: "Sem verba agora",
  reestruturando: "Reestruturando a operação",
  aguardando_decisao: "Aguardando decisão interna",
  sazonalidade: "Fora de época (sazonalidade)",
  outro: "Outro",
};

export const MOTIVO_DESQUALIFICACAO_LABELS: Record<MotivoDesqualificacao, string> = {
  nao_e_confeccao: "Não é confecção",
  muito_pequeno: "Muito pequeno / sem estrutura",
  sem_verba: "Sem verba pra investir",
  fora_perfil: "Fora do perfil (ICP)",
  nao_decisor: "Não é o decisor",
  ja_tem_solucao: "Já tem agência/solução",
  sem_interesse: "Sem interesse real",
  nao_respondeu: "Não respondeu / sumiu",
  regiao_fora: "Região/segmento fora do foco",
  outro: "Outro",
};

// Normaliza um telefone pra comparar/deduplicar: só dígitos, com código do país.
// "(11) 91234-5678" e "55 11 91234 5678" viram a mesma string.
export function normalizePhone(telefone: string | null | undefined): string {
  const digits = (telefone ?? "").replace(/\D/g, "");
  if (!digits) return "";
  return digits.length >= 12 ? digits : `55${digits}`;
}

// Helper pra montar telefone formatado pra wa.me
export function whatsappLink(telefone: string): string {
  return `https://wa.me/${normalizePhone(telefone)}`;
}

// Acha um lead já existente com o mesmo contato (telefone ou @instagram).
// `ignoreId` exclui o próprio lead (útil ao editar).
export function findDuplicateLead(
  leads: Lead[],
  contact: { telefone?: string | null; instagram?: string | null },
  ignoreId?: string,
): Lead | null {
  const phone = normalizePhone(contact.telefone);
  const insta = (contact.instagram ?? "").trim().replace(/^@/, "").toLowerCase();
  for (const l of leads) {
    if (ignoreId && l.id === ignoreId) continue;
    if (phone && normalizePhone(l.telefone) === phone) return l;
    if (insta && (l.instagram ?? "").trim().replace(/^@/, "").toLowerCase() === insta) return l;
  }
  return null;
}
