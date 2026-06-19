// Espelho enxuto dos tipos/labels/regras do app (lib/types.ts), só o que a
// extensão usa. Mantenha em sincronia se o funil mudar.

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
  updated_at: string;
};

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

// Cor do "ponto" de cada etapa (hex aproximando o tema do app).
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
  meta_ads: "Meta Ads",
  indicacao: "Indicação",
  outbound: "Outbound",
  outro: "Outro",
};

// Etapas que o SDR pode mover (igual SDR_STAGES do app).
export const SDR_STAGES: LeadStatus[] = [
  "qualificado", "em_agendamento", "agendando", "reuniao_agendada", "carteira", "desqualificado", "sem_resposta",
];

// Etapas movíveis DIRETO pela extensão (sem precisar de info extra: closer/data,
// motivo de perda/desqualificação, código do criativo). O resto faz-se no app.
export const SAFE_STAGES: LeadStatus[] = [
  "qualificado", "em_agendamento", "agendando", "follow_up", "carteira", "sem_resposta",
];

export function canMoveTo(
  status: LeadStatus,
  opts: { role: string | null; isAdmin: boolean },
): boolean {
  if (opts.isAdmin) return true;
  if (opts.role === "Closer") return true;
  if (opts.role === "SDR") return SDR_STAGES.includes(status);
  return true;
}

// Mover pra antes da reunião limpa o agendamento (espelha useLeads do app).
export function patchForStatus(status: LeadStatus): Record<string, unknown> {
  const patch: Record<string, unknown> = { status };
  if (status === "qualificado" || status === "em_agendamento" || status === "agendando") {
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

// O título do chat parece um número de telefone (contato não salvo)?
export function looksLikePhone(s: string): boolean {
  const digits = s.replace(/\D/g, "");
  return digits.length >= 8 && /^[+\d][\d\s().-]+$/.test(s.trim());
}
