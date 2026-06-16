import type { Lead } from "@/lib/types";

// ============================================================
// Qualidade do lead — derivada das respostas de qualificação.
// Não há coluna no banco: o score é sempre calculado on-the-fly,
// igual à gamificação. Para ajustar o "peso" de cada resposta,
// mude os números nas tabelas abaixo (0 = ruim · 1 = ótimo) e o
// WEIGHTS (quanto cada pergunta importa no total).
// ============================================================

// Quanto cada resposta "vale" (0 a 1)
const SCORES = {
  // BANT — qualificação clássica
  bant_budget: { tem_verba: 1, tem_indefinida: 0.5, nao_tem: 0 },
  bant_authority: { decisor: 1, influenciador: 0.5, precisa_aprovar: 0.3 },
  bant_need: { alta: 1, media: 0.5, explorando: 0.2 },
  bant_timing: { agora: 1, "30_dias": 0.7, "60_90_dias": 0.4, sem_urgencia: 0.1 },
  // Qualificação operacional
  estoque: { muito: 1, medio: 0.5, pouco: 0.2 },
  historico: { fazendo: 1, ja_fez: 0.6, nunca_fez: 0.3 },
  estrutura: { "2_mais_vendedores": 1, "1_vendedor": 0.6, dono_vende: 0.3 },
  // Maturidade / momento
  experiencia: { mais_5anos: 1, "1_5anos": 0.8, "6m_1ano": 0.5, menos_6m: 0.2 },
  situacao: { com_com_demanda: 1, com_sem_demanda: 0.5, sem_clientes: 0.2 },
  canal_vendas: { online: 1, box: 0.7, loja: 0.6 },
} as const;

// Quanto cada pergunta pesa no total (somam 100)
const WEIGHTS: Record<keyof typeof SCORES, number> = {
  bant_budget: 12,
  bant_authority: 10,
  bant_need: 10,
  bant_timing: 8,
  estoque: 10,
  historico: 10,
  estrutura: 10,
  experiencia: 10,
  situacao: 12,
  canal_vendas: 8,
};

export type LeadPriority = "alta" | "media" | "baixa";

export type LeadScore = {
  /** 0–100 (proporcional só aos campos preenchidos) */
  score: number;
  /** 1–5 estrelas */
  stars: number;
  priority: LeadPriority;
  /** quantos dos 10 campos de qualificação estão preenchidos */
  answered: number;
  total: number;
};

export const PRIORITY_LABELS: Record<LeadPriority, string> = {
  alta: "Prioridade alta",
  media: "Prioridade média",
  baixa: "Prioridade baixa",
};

// Rótulo curto (pro card e pros filtros).
export const PRIORITY_SHORT: Record<LeadPriority, string> = {
  alta: "Alta",
  media: "Média",
  baixa: "Baixa",
};

export const PRIORITY_META: Record<LeadPriority, { emoji: string; text: string; bg: string; border: string }> = {
  alta: { emoji: "🔥", text: "text-rose-300", bg: "bg-rose-500/10", border: "border-rose-500/30" },
  media: { emoji: "⏳", text: "text-amber-300", bg: "bg-amber-500/10", border: "border-amber-500/30" },
  baixa: { emoji: "🧊", text: "text-sky-300", bg: "bg-sky-500/10", border: "border-sky-500/30" },
};

export function computeLeadScore(lead: Lead): LeadScore {
  let earned = 0;
  let possible = 0;
  let answered = 0;
  const total = Object.keys(WEIGHTS).length;

  for (const key of Object.keys(WEIGHTS) as (keyof typeof SCORES)[]) {
    const value = lead[key] as string | null;
    if (value == null) continue;
    const map = SCORES[key] as Record<string, number>;
    if (!(value in map)) continue;
    const weight = WEIGHTS[key];
    earned += map[value] * weight;
    possible += weight;
    answered += 1;
  }

  // Score normalizado só pelos campos preenchidos (justo com leads antigos)
  const score = possible > 0 ? Math.round((earned / possible) * 100) : 0;

  const stars =
    score >= 80 ? 5 :
    score >= 65 ? 4 :
    score >= 50 ? 3 :
    score >= 35 ? 2 : 1;

  // Prioridade combina fit (score) com urgência (timing)
  const urgente = lead.bant_timing === "agora" || lead.bant_timing === "30_dias";
  let priority: LeadPriority;
  if (score >= 80 || (score >= 65 && urgente)) priority = "alta";
  else if (score >= 50) priority = "media";
  else priority = "baixa";

  return { score, stars, priority, answered, total };
}
