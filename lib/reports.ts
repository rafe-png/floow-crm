import {
  MOTIVO_PERDA_LABELS,
  STATUS_LABELS,
  type Lead,
  type LeadStatus,
  type MotivoPerda,
} from "@/lib/types";

export type Period = "hoje" | "semana" | "mes" | "trimestre" | "ano" | "tudo";

export const PERIOD_LABELS: Record<Period, string> = {
  hoje: "Hoje",
  semana: "Esta semana",
  mes: "Este mês",
  trimestre: "Este trimestre",
  ano: "Este ano",
  tudo: "Tudo",
};

function startOfDay(d: Date) { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; }
function startOfIsoWeek(d: Date) {
  const x = new Date(d);
  const day = x.getDay();
  const diff = (day === 0 ? -6 : 1) - day;
  x.setDate(x.getDate() + diff);
  x.setHours(0, 0, 0, 0);
  return x;
}
function startOfMonth(d: Date) { const x = new Date(d); x.setDate(1); x.setHours(0, 0, 0, 0); return x; }
function startOfQuarter(d: Date) {
  const x = new Date(d);
  const q = Math.floor(x.getMonth() / 3) * 3;
  x.setMonth(q, 1);
  x.setHours(0, 0, 0, 0);
  return x;
}
function startOfYear(d: Date) { const x = new Date(d); x.setMonth(0, 1); x.setHours(0, 0, 0, 0); return x; }

export function startOfPeriod(p: Period): Date | null {
  const now = new Date();
  switch (p) {
    case "hoje":       return startOfDay(now);
    case "semana":     return startOfIsoWeek(now);
    case "mes":        return startOfMonth(now);
    case "trimestre":  return startOfQuarter(now);
    case "ano":        return startOfYear(now);
    case "tudo":       return null;
  }
}

/** Filtra leads cuja criação caiu no período. */
export function filterLeadsByPeriod(leads: Lead[], period: Period): Lead[] {
  const start = startOfPeriod(period);
  if (!start) return leads;
  return leads.filter((l) => new Date(l.created_at) >= start);
}

// ============================================================
// Reports
// ============================================================

export type FunnelStat = { status: LeadStatus; label: string; count: number; pct: number };

export function buildFunnel(leads: Lead[]): FunnelStat[] {
  const order: LeadStatus[] = [
    "reuniao_agendada",
    "no_show",
    "follow_up",
    "carteira",
    "negocio_ganho",
    "negocio_perdido",
  ];
  const counts: Record<LeadStatus, number> = {
    reuniao_agendada: 0, no_show: 0, follow_up: 0, carteira: 0, negocio_ganho: 0, negocio_perdido: 0,
  };
  for (const l of leads) counts[l.status]++;
  const total = leads.length || 1;
  return order.map((s) => ({
    status: s,
    label: STATUS_LABELS[s],
    count: counts[s],
    pct: (counts[s] / total) * 100,
  }));
}

export type CoreKpis = {
  totalLeads: number;
  agendamentos: number;
  reunioesRealizadas: number;
  ganhos: number;
  perdidos: number;
  noShow: number;
  winRate: number;            // % entre fechados (ganho/(ganho+perdido))
  conversionRate: number;     // % de leads agendados que viraram ganho
  noShowRate: number;         // % de no_show entre agendamentos
  pipelineValor: number;
  faturamentoGanho: number;
  ticketMedio: number;        // valor médio de leads ganhos
  ticketMedioPipeline: number;// valor médio de leads ativos
  tempoMedioFechamentoDias: number | null;
};

export function buildCoreKpis(leads: Lead[]): CoreKpis {
  const totalLeads = leads.length;
  const agendamentos = leads.filter((l) => l.agendado_em).length;
  const ganhos = leads.filter((l) => l.status === "negocio_ganho").length;
  const perdidos = leads.filter((l) => l.status === "negocio_perdido").length;
  const noShow = leads.filter((l) => l.status === "no_show").length;
  // "reunião realizada" = saiu de reunião agendada pra qualquer coisa exceto no_show
  const reunioesRealizadas = leads.filter(
    (l) => l.agendado_em && !["reuniao_agendada", "no_show"].includes(l.status),
  ).length;

  const winRate = ganhos + perdidos > 0 ? (ganhos / (ganhos + perdidos)) * 100 : 0;
  const conversionRate = agendamentos > 0 ? (ganhos / agendamentos) * 100 : 0;
  const noShowRate = agendamentos > 0 ? (noShow / agendamentos) * 100 : 0;

  const pipelineValor = leads
    .filter((l) => l.status !== "negocio_perdido" && l.valor)
    .reduce((acc, l) => acc + Number(l.valor), 0);
  const faturamentoGanho = leads
    .filter((l) => l.status === "negocio_ganho" && l.valor)
    .reduce((acc, l) => acc + Number(l.valor), 0);

  const ganhosComValor = leads.filter((l) => l.status === "negocio_ganho" && l.valor);
  const ticketMedio = ganhosComValor.length > 0
    ? faturamentoGanho / ganhosComValor.length
    : 0;
  const ativosComValor = leads.filter((l) => l.status !== "negocio_perdido" && l.valor);
  const ticketMedioPipeline = ativosComValor.length > 0
    ? pipelineValor / ativosComValor.length
    : 0;

  // Tempo médio de fechamento (em dias) — entre agendado_em e ganho_em
  const ganhosComTempo = leads.filter((l) => l.agendado_em && l.ganho_em);
  let tempoMedio: number | null = null;
  if (ganhosComTempo.length > 0) {
    const totalDays = ganhosComTempo.reduce((acc, l) => {
      const a = new Date(l.agendado_em!).getTime();
      const g = new Date(l.ganho_em!).getTime();
      return acc + (g - a) / 86400000;
    }, 0);
    tempoMedio = totalDays / ganhosComTempo.length;
  }

  return {
    totalLeads,
    agendamentos,
    reunioesRealizadas,
    ganhos,
    perdidos,
    noShow,
    winRate,
    conversionRate,
    noShowRate,
    pipelineValor,
    faturamentoGanho,
    ticketMedio,
    ticketMedioPipeline,
    tempoMedioFechamentoDias: tempoMedio,
  };
}

export type LossReasonStat = { motivo: MotivoPerda; label: string; count: number; pct: number };

export function buildLossReasons(leads: Lead[]): LossReasonStat[] {
  const perdidos = leads.filter((l) => l.status === "negocio_perdido");
  const counts = new Map<MotivoPerda | "sem_motivo", number>();
  for (const l of perdidos) {
    const k = (l.motivo_perda ?? "sem_motivo") as MotivoPerda;
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  const total = perdidos.length || 1;
  return Array.from(counts.entries())
    .map(([motivo, count]) => ({
      motivo: motivo as MotivoPerda,
      label: MOTIVO_PERDA_LABELS[motivo as MotivoPerda] ?? "Sem motivo",
      count,
      pct: (count / total) * 100,
    }))
    .sort((a, b) => b.count - a.count);
}

export type PersonStat = { name: string; agendamentos: number; ganhos: number; faturamento: number };

export function buildPersonStats(leads: Lead[], role: "SDR" | "Closer"): PersonStat[] {
  const field = role === "SDR" ? "sdr_responsavel" : "closer_responsavel";
  const map = new Map<string, PersonStat>();
  for (const l of leads) {
    const name = (l[field] as string | null) ?? "Não atribuído";
    const cur = map.get(name) ?? { name, agendamentos: 0, ganhos: 0, faturamento: 0 };
    if (l.agendado_em) cur.agendamentos++;
    if (l.status === "negocio_ganho") {
      cur.ganhos++;
      if (l.valor) cur.faturamento += Number(l.valor);
    }
    map.set(name, cur);
  }
  return Array.from(map.values()).sort((a, b) => b.ganhos - a.ganhos);
}

// ============================================================
// CSV
// ============================================================

function csvEscape(v: unknown): string {
  if (v == null) return "";
  const s = String(v);
  if (s.includes(",") || s.includes("\"") || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function buildLeadsCsv(leads: Lead[]): string {
  const headers = [
    "Criado em",
    "Empresa",
    "Decisor",
    "Cargo",
    "Telefone",
    "Instagram",
    "Status",
    "Valor",
    "SDR responsável",
    "Closer responsável",
    "Agendado em",
    "Ganho em",
    "Local",
    "Estoque",
    "Histórico tráfego",
    "Estrutura comercial",
    "BANT Budget",
    "BANT Authority",
    "BANT Need",
    "BANT Timing",
    "Motivo perda",
    "Observações",
    "Meet link",
  ];
  const rows = leads.map((l) => [
    new Date(l.created_at).toISOString(),
    l.empresa ?? "",
    l.nome,
    l.cargo ?? "",
    l.telefone,
    l.instagram ?? "",
    STATUS_LABELS[l.status],
    l.valor ?? "",
    l.sdr_responsavel ?? "",
    l.closer_responsavel ?? "",
    l.agendado_em ?? "",
    l.ganho_em ?? "",
    l.local ?? "",
    l.estoque ?? "",
    l.historico ?? "",
    l.estrutura ?? "",
    l.bant_budget ?? "",
    l.bant_authority ?? "",
    l.bant_need ?? "",
    l.bant_timing ?? "",
    l.motivo_perda ?? "",
    l.observacoes ?? "",
    l.meet_link ?? "",
  ]);
  const lines = [headers, ...rows].map((row) => row.map(csvEscape).join(","));
  return lines.join("\n");
}

export function downloadCsv(filename: string, content: string) {
  const blob = new Blob(["﻿" + content], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
