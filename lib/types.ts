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
export type BantAuthority = "decisor" | "tem_socio";
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
  // Opções ATIVAS (aparecem no seletor de desqualificar):
  | "muito_pequeno"
  | "sem_estoque"
  | "margem_baixa"
  | "sem_verba"      // rotulado "Sem budget"
  | "revende"
  | "regiao_fora"    // rotulado "Segmento fora do foco"
  | "sem_instagram"
  | "sem_fit"
  // LEGADAS (só pra exibir histórico; fora do seletor):
  | "nao_e_confeccao"
  | "fora_perfil"
  | "nao_decisor"
  | "ja_tem_solucao"
  | "sem_interesse"
  | "nao_respondeu"
  | "outro";

// ============================================================
// Lead
// ============================================================
export type Lead = {
  id: string;
  created_at: string;
  updated_at: string;
  // Início do CICLO de cadência atual (migração 076). O relógio de 20 dias / a
  // cobrança de toque contam a partir daqui; created_at (entrada original) não muda.
  // Opcional: rows carregadas antes da migração rodar não trazem o campo → cai pra
  // created_at nos helpers (ver cycleStart/isCadenceExpired).
  ciclo_entrada_em?: string | null;
  last_inbound_at: string | null; // última mensagem do lead (temperatura/reaquecimento)
  // Rastreio de anúncio (migrações 061/064) — preenchido pela ponte de clique da LP.
  canal: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_content: string | null;
  utm_term: string | null;
  campaign_id: string | null;
  adset_id: string | null;
  ad_id: string | null;
  fbclid: string | null;
  fbc: string | null;                 // cookie _fbc (match forte no CAPI) — migração 066
  fbp: string | null;                 // cookie _fbp (match forte no CAPI) — migração 066
  client_ip_address: string | null;   // reforço de match server-side — migração 066
  client_user_agent: string | null;   // reforço de match server-side — migração 066
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
  // Quem realizou o agendamento (team_members.name) — carimbado ao mover pra
  // "Reunião agendada". Não confundir com sdr_responsavel (origem) nem closer.
  agendado_por: string | null;
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
  // Código do anúncio como TEXTO (alfanumérico: 'C1-25', '08V2') — vem do webhook
  // conforme o cadastro em `ad_codes`. Numéricos preenchem também `criativo_codigo`.
  criativo_codigo_txt: string | null;

  // Origem do lead: 'manual' (cadastrado à mão) | 'whatsapp' (entrou pelo anúncio).
  // Uso interno (filtro/roteamento), não confundir com `fonte` (marketing).
  origem: string | null;

  // Fonte de marketing do lead (exibida/selecionável no card). Leads que entram
  // pela automação do WhatsApp já nascem como 'meta_ads'.
  fonte: LeadFonte | null;

  // Estrela de PRIORIDADE manual (migração 075). true = ranqueado no topo da coluna
  // no kanban (CRM + extensão). Priorização manual, independente do score/BANT.
  prioridade: boolean;
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

// Canal = plataforma real do lead (preenchido automático pelo prefixo do código /
// ponte de clique da LP). É mais específico que a `fonte` (IG/FB/MT são todos
// "meta_ads" na fonte). Usado pra exibir a ORIGEM real do lead.
export const CANAL_LABELS: Record<string, string> = {
  ig: "Instagram",
  wa: "WhatsApp",
  fb: "Facebook",
  mt: "Meta Ads",
  ad: "Meta Ads",
  meta: "Meta",
  whatsapp: "WhatsApp",
  manual: "Manual",
};

// Origem de EXIBIÇÃO do lead: prioriza o canal real (ig → Instagram); se não houver
// canal, cai pra fonte (meta_ads → Meta Ads, indicação, etc.).
export function origemLabel(lead: { canal?: string | null; fonte?: string | null }): string | null {
  if (lead.canal) return CANAL_LABELS[lead.canal] ?? lead.canal;
  if (lead.fonte) return FONTE_LABELS[lead.fonte as LeadFonte] ?? lead.fonte;
  return null;
}

// Código do criativo SEM o prefixo de canal: "MT08" → "08", "IG08" → "08", "IG-08" → "08".
// Pra exibir só o criativo (a origem/canal é mostrada separada). Códigos sem prefixo
// conhecido (numéricos "08", legado "C1-25") ficam inteiros.
export function creativeCodeClean(code: string | null | undefined): string | null {
  if (!code) return null;
  const m = code.toUpperCase().match(/^(IG|WA|FB|MT)-?(.+)$/);
  return m && m[2] ? m[2] : code;
}

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


export type LeadEventType = "created" | "status_change" | "note" | "ligacao";

// Resultado de uma ligação (registrada pela extensão ou pela API4COM no histórico).
export type CallOutcome =
  | "atendeu" | "atendeu_desligou" | "rejeitou" | "chamou_ate_cair" | "nao_chamou"
  // resultados da ligação por telefone (API4COM):
  | "nao_atendeu" | "ocupado" | "caixa_postal" | "ligando" | "falhou";
export const CALL_OUTCOME_LABELS: Record<CallOutcome, string> = {
  atendeu: "Atendeu ✅",
  atendeu_desligou: "Atendeu mas desligou",
  rejeitou: "Rejeitou",
  chamou_ate_cair: "Chamou até cair",
  nao_chamou: "Não chamou",
  nao_atendeu: "Não atendeu",
  ocupado: "Ocupado",
  caixa_postal: "Caixa postal / caiu rápido",
  ligando: "Ligando…",
  falhou: "Não completou",
};

// Opções mostradas no popup "Como foi a ligação?" das ligações por TELEFONE (API4COM).
// O vendedor marca o resultado no fim da ligação (a classificação automática do
// webhook erra em caixa postal / não-atende, então a escolha manual é a verdade).
export const CALL_OUTCOME_PHONE: { value: CallOutcome; label: string }[] = [
  { value: "atendeu", label: "Atendeu ✅" },
  { value: "nao_atendeu", label: "Não atendeu" },
  { value: "caixa_postal", label: "Caixa postal" },
  { value: "ocupado", label: "Ocupado" },
];

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
  /** Grava as ligações da extensão (migração 060). Controlado só pelo admin. Default true. */
  record_calls?: boolean;
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
  tipo: TaskTipo;
  recorrente: boolean;   // ao concluir, recria a mesma tarefa pro dia seguinte
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

// Playbook comercial (tipo Notion). Admin edita; todos leem.
// `tipo` separa as 3 guias: documento (Markdown) · mapa_mental / organograma (Mermaid).
export type PlaybookTipo = "documento" | "mapa_mental" | "organograma";

export const PLAYBOOK_TIPO_LABELS: Record<PlaybookTipo, string> = {
  documento: "Documentos",
  mapa_mental: "Mapa mental",
  organograma: "Organograma",
};

export type Playbook = {
  id: string;
  title: string;
  emoji: string | null;
  categoria: string | null;
  conteudo: string;
  tipo: PlaybookTipo;
  ordem: number;
  updated_by: string | null;
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
  tipo?: TaskTipo;
  recorrente?: boolean;
};

// ============================================================
// Tarefas tipadas (agenda + tarefa que nasce do funil)
// ============================================================
export type TaskTipo = "qualificar" | "agendar" | "lembrete_reuniao" | "follow_up" | "pos_venda" | "outro";

export const TASK_TIPO_LABELS: Record<TaskTipo, string> = {
  qualificar: "Qualificar",
  agendar: "Agendar",
  lembrete_reuniao: "Lembrete de reunião",
  follow_up: "Follow-up",
  pos_venda: "Pós-venda",
  outro: "Outro",
};
export const TASK_TIPO_ICONS: Record<TaskTipo, string> = {
  qualificar: "🔍", agendar: "📅", lembrete_reuniao: "⏰", follow_up: "🔁", pos_venda: "🎁", outro: "📌",
};
export const TASK_TIPO_COLORS: Record<TaskTipo, string> = {
  qualificar: "#38bdf8", agendar: "#f5c518", lembrete_reuniao: "#a78bfa", follow_up: "#fb923c", pos_venda: "#34d399", outro: "#71717a",
};
// Tipos oferecidos nos seletores (Outro fica de fora do fluxo padrão).
export const TASK_TIPO_OPTIONS: TaskTipo[] = ["qualificar", "agendar", "lembrete_reuniao", "follow_up", "pos_venda"];

// Ao mover o lead pra essa etapa, sugere criar uma tarefa desse tipo (popup).
export const STAGE_TASK_TIPO: Partial<Record<LeadStatus, TaskTipo>> = {
  qualificado: "qualificar",
  pre_qualificado: "qualificar",
  em_agendamento: "agendar",
  agendando: "agendar",
  reuniao_agendada: "lembrete_reuniao",
  no_show: "follow_up",
  follow_up: "follow_up",
  negocio_ganho: "pos_venda",
};

// Prazo SUGERIDO (ISO) por tipo — só onde faz sentido. null = deixa em branco
// pro usuário escolher (Qualificar/Agendar/Follow-up variam demais).
//   - Pós-venda: 7 dias após o ganho (agora), às 09h.
//   - Lembrete de reunião: no DIA da reunião, às 09h (puxa data_agendamento do lead).
export function suggestedTaskDue(tipo: TaskTipo, lead?: { data_agendamento?: string | null } | null): string | null {
  const atTime = (base: Date, h: number, m = 0) => { const x = new Date(base); x.setHours(h, m, 0, 0); return x; };
  if (tipo === "pos_venda") {
    const d = new Date(); d.setDate(d.getDate() + 7);
    return atTime(d, 9).toISOString();
  }
  if (tipo === "lembrete_reuniao") {
    if (!lead?.data_agendamento) return null;
    return atTime(new Date(lead.data_agendamento), 9).toISOString(); // dia da reunião, 09h
  }
  return null; // qualificar / agendar / follow_up / outro → sem sugestão
}

// Título padrão da tarefa: "{Tipo} — {empresa/nome}".
export function taskTitleFor(tipo: TaskTipo, lead?: { empresa?: string | null; nome?: string | null } | null): string {
  const alvo = lead?.empresa || lead?.nome || "";
  return alvo ? `${TASK_TIPO_LABELS[tipo]} — ${alvo}` : TASK_TIPO_LABELS[tipo];
}

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

export type MetaCampaignMeta = {
  campaign_id: string;
  name: string | null;
  effective_status: string | null; // ACTIVE, PAUSED, CAMPAIGN_PAUSED, ARCHIVED, …
  daily_budget: number | null;      // orçamento diário (R$); null em ABO
  lifetime_budget: number | null;   // orçamento vitalício (R$)
  updated_at: string;
};

export type MetaAdsetMeta = {
  adset_id: string;
  campaign_id: string | null;
  name: string | null;
  effective_status: string | null;
  daily_budget: number | null;
  lifetime_budget: number | null;
  updated_at: string;
};

export type MetaAdMeta = {
  ad_id: string;
  adset_id: string | null;
  campaign_id: string | null;
  name: string | null;
  effective_status: string | null;
  updated_at: string;
};

export type MetaCampaignSpendDay = {
  day: string;
  campaign_id: string;
  campaign_name: string | null;
  adset_id: string;
  adset_name: string | null;
  ad_id: string;
  ad_name: string | null;
  spend: number;
  leads: number;
  impressions: number;
  clicks: number;
  updated_at: string;
};

// ============================================================
// Constantes de UI
// ============================================================
export const STATUS_ORDER: LeadStatus[] = [
  "desqualificado",
  "sem_resposta",
  "qualificado",      // Entrada
  "pre_qualificado",
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
  "agendando",
  "reuniao_agendada",
  "no_show",
  "follow_up",
  "carteira",
];

// ============================================================
// Cadência de toques (20 dias · 3 toques/dia)
// ============================================================
// Zona de cadência = etapas onde o lead ainda é TRABALHADO pelo SDR com ligações
// diárias e onde vale o relógio de vida útil. Vai da Entrada (qualificado) até
// "Qualificado" (em_agendamento). Ao entrar em "Em agendamento" (agendando) o lead
// já está sendo marcado → sai da cadência: não cobra toque diário nem expira.
export const CADENCE_STAGES: LeadStatus[] = ["qualificado", "pre_qualificado", "em_agendamento"];
export function isCadenceStage(status: LeadStatus): boolean {
  return CADENCE_STAGES.includes(status);
}
// Meta diária de toques (ligações) por lead na cadência — as 3 bolinhas do card.
export const DAILY_TOUCH_GOAL = 3;
// Vida útil do lead na cadência, em dias, antes de exigir troca de SDR (sem ir pro
// Reaquecimento — fica na Entrada e troca o dono via aviso no Dashboard).
export const CADENCE_LIFETIME_DAYS = 20;

// Início do ciclo de cadência do lead. Usa ciclo_entrada_em; se o campo ainda não
// existir (migração 076 não rodou) cai pra created_at.
export function cycleStart(lead: Lead): Date {
  return new Date(lead.ciclo_entrada_em ?? lead.created_at);
}
// Dias corridos desde o início do ciclo atual (base do relógio de 20 dias).
export function cadenceCycleDays(lead: Lead, nowMs: number): number {
  return (nowMs - cycleStart(lead).getTime()) / 86_400_000;
}
// Lead "venceu": está na zona de cadência E o ciclo atual passou dos 20 dias.
// Esses são os que aparecem no aviso do Dashboard pra troca de SDR.
// IMPORTANTE: exige ciclo_entrada_em preenchido (a cadência precisa ter sido
// iniciada — migração 076). Sem ele, NÃO conta como vencido — evita uma enxurrada
// falsa de "vencidos" por created_at antes da cadência estar ligada.
export function isCadenceExpired(lead: Lead, nowMs: number): boolean {
  if (!lead.ciclo_entrada_em) return false;
  if (!isCadenceStage(lead.status)) return false;
  return cadenceCycleDays(lead, nowMs) >= CADENCE_LIFETIME_DAYS;
}

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
  sem_resposta: "Reaquecimento",
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
  tem_socio: "Tem sócio",
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
  // Ativas
  muito_pequeno: "Muito pequeno / sem estrutura",
  sem_estoque: "Sem estoque",
  margem_baixa: "Margem muito baixa",
  sem_verba: "Sem budget",
  revende: "Revende",
  regiao_fora: "Segmento fora do foco",
  sem_instagram: "Sem Instagram",
  sem_fit: "Sem fit",
  // Legadas (só exibição do histórico)
  nao_e_confeccao: "Não é confecção",
  fora_perfil: "Fora do perfil (ICP)",
  nao_decisor: "Não é o decisor",
  ja_tem_solucao: "Já tem agência/solução",
  sem_interesse: "Sem interesse real",
  nao_respondeu: "Não respondeu / sumiu",
  outro: "Outro",
};

// Motivos mostrados no SELETOR de desqualificar (nesta ordem). As legadas ficam
// fora daqui — só existem no mapa acima pra exibir leads antigos.
export const MOTIVO_DESQUALIFICACAO_OPTIONS: MotivoDesqualificacao[] = [
  "muito_pequeno", "sem_estoque", "margem_baixa", "sem_verba", "revende", "regiao_fora", "sem_instagram", "sem_fit",
];

// Normaliza um telefone pra comparar/deduplicar: só dígitos, com código do país.
// "(11) 91234-5678" e "55 11 91234 5678" viram a mesma string.
export function normalizePhone(telefone: string | null | undefined): string {
  const digits = (telefone ?? "").replace(/\D/g, "");
  if (!digits) return "";
  return digits.length >= 12 ? digits : `55${digits}`;
}

/**
 * Chave CANÔNICA do telefone pra comparar/deduplicar (não pra discar).
 * Resolve o 9º dígito do celular BR: '5581996707429', '81996707429' e
 * '558196707429' viram a MESMA chave ('8196707429'). Mesma lógica do webhook.
 */
export function phoneKey(telefone: string | null | undefined): string {
  let d = (telefone ?? "").replace(/\D/g, "");
  if (!d) return "";
  d = d.replace(/^55/, "");                                   // tira código do país
  if (d.length === 11 && d[2] === "9") d = d.slice(0, 2) + d.slice(3); // tira o 9 extra do celular
  return d;
}

// Helper pra abrir a conversa direto no WhatsApp WEB (não no app do PC).
export function whatsappLink(telefone: string, text?: string): string {
  const base = `https://web.whatsapp.com/send?phone=${normalizePhone(telefone)}`;
  return text ? `${base}&text=${encodeURIComponent(text)}` : base;
}

// Nome fixo da aba do WhatsApp Web — usar como `target` pra reaproveitar a MESMA
// aba entre leads (em vez de abrir uma janela nova a cada clique).
export const WHATSAPP_TAB = "floow_whatsapp_web";

// Acha um lead já existente com o mesmo contato (telefone ou @instagram).
// `ignoreId` exclui o próprio lead (útil ao editar).
export function findDuplicateLead(
  leads: Lead[],
  contact: { telefone?: string | null; instagram?: string | null },
  ignoreId?: string,
): Lead | null {
  const phone = phoneKey(contact.telefone);
  const insta = (contact.instagram ?? "").trim().replace(/^@/, "").toLowerCase();
  for (const l of leads) {
    if (ignoreId && l.id === ignoreId) continue;
    if (phone && phone.length >= 8 && phoneKey(l.telefone) === phone) return l;
    if (insta && (l.instagram ?? "").trim().replace(/^@/, "").toLowerCase() === insta) return l;
  }
  return null;
}

// ============================================================
// Temperatura do lead — por DIAS desde a ENTRADA no CRM (created_at).
// (Redefinido 2026-11-12, a pedido do Rafe. Antes era por horas desde a última
// resposta.) Faixas: <3d Super hot · 3–7d Hot · 7–14d Warm · 14–30d Cold · +30d Frio.
// Usada no SELO de temperatura de TODO card do CRM e pra montar as 4 faixas da Entrada.
// +30d (frio) é movido pra Reaquecimento pela automação /api/cron/entrada-aging.
// ============================================================
export type LeadTempKey = "super_hot" | "hot" | "warm" | "cold" | "frio";
export type LeadTemp = { key: LeadTempKey; label: string; emoji: string; dot: string; text: string; border: string; days: number };

export const TEMP_META: Record<LeadTempKey, { label: string; emoji: string; dot: string; text: string; border: string }> = {
  super_hot: { label: "Super hot", emoji: "🔥", dot: "bg-red-500",    text: "text-red-400",    border: "border-red-500/40" },
  hot:       { label: "Hot",       emoji: "🟠", dot: "bg-orange-500", text: "text-orange-400", border: "border-orange-500/40" },
  warm:      { label: "Warm",      emoji: "🟡", dot: "bg-amber-400",  text: "text-amber-300",  border: "border-amber-400/40" },
  cold:      { label: "Cold",      emoji: "🔵", dot: "bg-sky-500",    text: "text-sky-400",    border: "border-sky-500/40" },
  frio:      { label: "Frio",      emoji: "⚪", dot: "bg-zinc-500",   text: "text-zinc-400",   border: "border-zinc-500/30" },
};

// Limite superior de DIAS de cada faixa (exclusivo). A última (frio) é aberta.
const TEMP_LEVELS: { key: LeadTempKey; maxDays: number }[] = [
  { key: "super_hot", maxDays: 3 },
  { key: "hot",       maxDays: 7 },
  { key: "warm",      maxDays: 14 },
  { key: "cold",      maxDays: 30 },
  { key: "frio",      maxDays: Infinity },
];

/** Dias em que um lead vira "frio" (+30d) → vai pra Reaquecimento. */
export const ENTRADA_FRIO_DAYS = 30;

/** Faixas exibidas na Entrada do kanban, da mais FRIA pra mais QUENTE (esq → dir). Exclui "frio" (+30d sai pra Reaquecimento). */
export const ENTRADA_BANDS: LeadTempKey[] = ["cold", "warm", "hot", "super_hot"];

/** Momento do último sinal do lead: a última resposta dele, ou a entrada. (Mantido p/ outros usos.) */
export function leadLastSignal(lead: Pick<Lead, "last_inbound_at" | "created_at">): string {
  return lead.last_inbound_at || lead.created_at;
}

/** Dias desde a entrada do lead no CRM (created_at). */
export function leadDaysInCrm(lead: Pick<Lead, "created_at">, nowMs: number): number {
  const base = new Date(lead.created_at).getTime();
  return Number.isFinite(base) ? (nowMs - base) / 86_400_000 : Infinity;
}

/** Temperatura do lead pela DATA DE ENTRADA (created_at), em dias. `nowMs` vem de fora (pureza de render do React 19). */
export function leadTemperature(lead: Pick<Lead, "created_at">, nowMs: number): LeadTemp {
  const days = leadDaysInCrm(lead, nowMs);
  const lvl = TEMP_LEVELS.find((l) => days < l.maxDays) ?? TEMP_LEVELS[TEMP_LEVELS.length - 1];
  return { key: lvl.key, ...TEMP_META[lvl.key], days };
}
