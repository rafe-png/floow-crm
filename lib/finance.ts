import { differenceInCalendarDays, format, parseISO } from "date-fns";
import type { AdInvestment, MetaAdSpendDay } from "@/lib/types";

/** "yyyy-MM-dd" de uma Date. */
export function dayKey(d: Date): string {
  return format(d, "yyyy-MM-dd");
}

/** Nº de dias (inclusivo) de um período "yyyy-MM-dd" → "yyyy-MM-dd". */
export function periodDays(inicio: string, fim: string): number {
  return differenceInCalendarDays(parseISO(fim), parseISO(inicio)) + 1;
}

/**
 * Soma de um campo dos lançamentos, proporcional aos dias que caem na janela
 * [windowStart, windowEnd] — assim um período semanal que cruza a virada do mês
 * é dividido corretamente. Usado pra investimento e pra leads dos anúncios.
 */
function prorateInWindow(
  investments: AdInvestment[],
  windowStart: Date,
  windowEnd: Date,
  pick: (inv: AdInvestment) => number,
): number {
  const ws = windowStart.getTime();
  const we = windowEnd.getTime();
  let total = 0;
  for (const inv of investments) {
    const is = parseISO(inv.periodo_inicio).getTime();
    const ie = parseISO(inv.periodo_fim).getTime();
    const overlapStart = Math.max(is, ws);
    const overlapEnd = Math.min(ie, we);
    if (overlapEnd < overlapStart) continue;
    const overlapDays = Math.round((overlapEnd - overlapStart) / 86_400_000) + 1;
    const totalDays = periodDays(inv.periodo_inicio, inv.periodo_fim);
    total += pick(inv) * (overlapDays / totalDays);
  }
  return total;
}

/** Investimento atribuído a uma janela [windowStart, windowEnd]. */
export function spendInWindow(investments: AdInvestment[], windowStart: Date, windowEnd: Date): number {
  return prorateInWindow(investments, windowStart, windowEnd, (i) => i.valor);
}

/** Leads (mensagens) dos anúncios atribuídos a uma janela. Arredonda no fim. */
export function adLeadsInWindow(investments: AdInvestment[], windowStart: Date, windowEnd: Date): number {
  return Math.round(prorateInWindow(investments, windowStart, windowEnd, (i) => i.leads_ads));
}

/** Soma simples de todos os investimentos. */
export function totalSpend(investments: AdInvestment[]): number {
  return investments.reduce((s, i) => s + i.valor, 0);
}

/** Soma simples de todos os leads dos anúncios. */
export function totalAdLeads(investments: AdInvestment[]): number {
  return investments.reduce((s, i) => s + i.leads_ads, 0);
}

/** Conjunto de dias "yyyy-MM-dd" já cobertos por algum investimento (pra travar no calendário). */
export function coveredDays(investments: AdInvestment[]): Set<string> {
  const set = new Set<string>();
  for (const inv of investments) {
    let d = parseISO(inv.periodo_inicio);
    const end = parseISO(inv.periodo_fim);
    while (d.getTime() <= end.getTime()) {
      set.add(dayKey(d));
      d = new Date(d.getTime() + 86_400_000);
    }
  }
  return set;
}

// ============================================================
// Gasto vindo da Meta (meta_ad_spend_daily) — granularidade diária, soma exata.
// ============================================================

/** Soma um campo das linhas diárias cujo dia cai em [start, end] (inclusivo). start null = tudo. */
function sumMetaInWindow(
  days: MetaAdSpendDay[],
  start: Date | null,
  end: Date,
  pick: (d: MetaAdSpendDay) => number,
): number {
  const startKey = start ? dayKey(start) : null;
  const endKey = dayKey(end);
  let total = 0;
  for (const d of days) {
    if (startKey && d.day < startKey) continue;
    if (d.day > endKey) continue;
    total += pick(d);
  }
  return total;
}

/** Gasto (R$) da Meta na janela [start, end]. start null = todo o histórico. */
export function metaSpendInWindow(days: MetaAdSpendDay[], start: Date | null, end: Date): number {
  return sumMetaInWindow(days, start, end, (d) => Number(d.spend) || 0);
}

/** Leads (conversas/mensagens) dos anúncios da Meta na janela [start, end]. */
export function metaLeadsInWindow(days: MetaAdSpendDay[], start: Date | null, end: Date): number {
  return sumMetaInWindow(days, start, end, (d) => Number(d.leads) || 0);
}

/** CAC = investimento ÷ nº de clientes ganhos. null se não houve ganho. */
export function cac(spend: number, ganhos: number): number | null {
  return ganhos > 0 ? spend / ganhos : null;
}

/** Custo por lead = investimento ÷ nº de leads. null se não houve lead. */
export function custoPorLead(spend: number, leads: number): number | null {
  return leads > 0 ? spend / leads : null;
}
