"use client";

import { useMemo, useState } from "react";
import { Download } from "lucide-react";
import { TopBar } from "@/components/layout/TopBar";
import { CreativeBars, MonthlyBars, WeekdayBars } from "@/components/relatorios/ReportCharts";
import { useAdInvestmentsContext } from "@/lib/contexts/AdInvestmentsContext";
import { useLeadsContext } from "@/lib/contexts/LeadsContext";
import { cac, custoPorLead, spendInWindow, totalSpend } from "@/lib/finance";
import {
  PERIOD_LABELS,
  buildCoreKpis,
  buildCreativeStats,
  buildFunnel,
  buildLeadsCsv,
  buildLossReasons,
  buildMonthlyStats,
  buildPersonStats,
  buildWeekdayStats,
  downloadCsv,
  filterLeadsByPeriod,
  startOfPeriod,
  type Period,
} from "@/lib/reports";
import { STATUS_COLORS } from "@/lib/types";

const PERIODS: Period[] = ["hoje", "semana", "mes", "trimestre", "ano", "tudo"];

export default function RelatoriosPage() {
  const { leads } = useLeadsContext();
  const { investments } = useAdInvestmentsContext();
  const [period, setPeriod] = useState<Period>("mes");

  const filtered = useMemo(() => filterLeadsByPeriod(leads, period), [leads, period]);
  const kpis = useMemo(() => buildCoreKpis(filtered), [filtered]);
  const funnel = useMemo(() => buildFunnel(filtered), [filtered]);
  const lossReasons = useMemo(() => buildLossReasons(filtered), [filtered]);
  const sdrStats = useMemo(() => buildPersonStats(filtered, "SDR"), [filtered]);
  const closerStats = useMemo(() => buildPersonStats(filtered, "Closer"), [filtered]);
  const monthly = useMemo(() => buildMonthlyStats(leads, 6), [leads]);
  const weekday = useMemo(() => buildWeekdayStats(filtered), [filtered]);
  const creatives = useMemo(() => buildCreativeStats(filtered), [filtered]);

  // Investimento + custo de aquisição no período selecionado.
  const finance = useMemo(() => {
    const start = startOfPeriod(period);
    const spend = start ? spendInWindow(investments, start, new Date()) : totalSpend(investments);
    return {
      spend,
      cpl: custoPorLead(spend, kpis.totalLeads),
      cacVal: cac(spend, kpis.ganhos),
    };
  }, [investments, period, kpis.totalLeads, kpis.ganhos]);

  function exportCsv() {
    const csv = buildLeadsCsv(filtered);
    const date = new Date().toISOString().slice(0, 10);
    downloadCsv(`floow_leads_${period}_${date}.csv`, csv);
  }

  const fmtBRL = (n: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(n);
  const fmtPct = (n: number) => `${n.toFixed(1)}%`;

  return (
    <>
      <TopBar title="Relatórios" />

      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-900 px-4 py-2.5 sm:px-6">
        <div className="flex flex-wrap gap-1">
          {PERIODS.map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`rounded-md border px-3 py-1.5 text-xs transition-colors ${
                period === p
                  ? "border-[#f5c518]/40 bg-[#f5c518]/10 text-[#f5c518]"
                  : "border-zinc-800 bg-zinc-900 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200"
              }`}
            >
              {PERIOD_LABELS[p]}
            </button>
          ))}
        </div>

        <button
          onClick={exportCsv}
          className="flex items-center gap-1.5 rounded-md border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-xs text-zinc-300 hover:border-zinc-700 hover:text-zinc-100"
        >
          <Download size={13} />
          Exportar CSV ({filtered.length})
        </button>
      </div>

      <main className="flex-1 overflow-y-auto px-4 py-5 sm:px-6">
        <div className="mx-auto max-w-5xl space-y-6">
          {/* KPIs principais */}
          <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Kpi label="Leads no período"     value={kpis.totalLeads.toString()} />
            <Kpi label="Agendamentos"          value={kpis.agendamentos.toString()} />
            <Kpi label="Reuniões realizadas"   value={kpis.reunioesRealizadas.toString()} />
            <Kpi label="Negócios ganhos"       value={kpis.ganhos.toString()} accent="emerald" />
            <Kpi label="Win rate"              value={fmtPct(kpis.winRate)} hint="ganho ÷ (ganho + perdido)" accent="yellow" />
            <Kpi label="Conversão geral"       value={fmtPct(kpis.conversionRate)} hint="ganho ÷ agendamentos" accent="emerald" />
            <Kpi label="No show"               value={fmtPct(kpis.noShowRate)} hint="no_show ÷ agendamentos" accent="rose" />
            <Kpi label="Tempo médio fechar"
              value={kpis.tempoMedioFechamentoDias != null ? `${kpis.tempoMedioFechamentoDias.toFixed(1)}d` : "—"}
              hint="agendar → ganhar"
            />
          </section>

          {/* Valores */}
          <section className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Kpi label="Pipeline ativo"        value={fmtBRL(kpis.pipelineValor)} accent="yellow" />
            <Kpi label="Faturamento ganho"     value={fmtBRL(kpis.faturamentoGanho)} accent="emerald" />
            <Kpi label="Ticket médio"          value={fmtBRL(kpis.ticketMedio)} hint="entre ganhos" />
          </section>

          {/* Custo de aquisição (vem do Financeiro) */}
          <section className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Kpi label="Investido em ads"  value={fmtBRL(finance.spend)} hint="no período" accent="yellow" />
            <Kpi label="Custo por lead"    value={finance.cpl != null ? fmtBRL(finance.cpl) : "—"} hint="investido ÷ leads" />
            <Kpi label="CAC"               value={finance.cacVal != null ? fmtBRL(finance.cacVal) : "—"} hint="investido ÷ clientes ganhos" accent="emerald" />
          </section>

          {/* Gráficos inteligentes */}
          <MonthlyBars data={monthly} />
          <section className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            <WeekdayBars data={weekday} />
            <CreativeBars data={creatives} />
          </section>

          {/* Funil */}
          <section className="rounded-xl border border-zinc-900 bg-zinc-950/60 p-4">
            <h3 className="mb-3 text-sm font-semibold text-zinc-200">Funil</h3>
            <div className="space-y-2">
              {funnel.map((s) => {
                const c = STATUS_COLORS[s.status];
                return (
                  <div key={s.status} className="flex items-center gap-3">
                    <div className="flex w-40 shrink-0 items-center gap-1.5 text-xs">
                      <span className={`h-1.5 w-1.5 rounded-full ${c.dot}`} />
                      <span className={c.text}>{s.label}</span>
                    </div>
                    <div className="flex-1">
                      <div className="h-5 w-full overflow-hidden rounded bg-zinc-900">
                        <div
                          className={`h-full ${c.bg} flex items-center justify-end pr-2 text-[10px] font-medium ${c.text}`}
                          style={{ width: `${Math.max(s.pct, s.count > 0 ? 6 : 0)}%` }}
                        >
                          {s.count > 0 && `${s.count} · ${s.pct.toFixed(0)}%`}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Motivos de perda */}
          {lossReasons.length > 0 && (
            <section className="rounded-xl border border-zinc-900 bg-zinc-950/60 p-4">
              <h3 className="mb-3 text-sm font-semibold text-zinc-200">Motivos de perda</h3>
              <div className="space-y-2">
                {lossReasons.map((m) => (
                  <div key={m.motivo} className="flex items-center gap-3">
                    <div className="w-40 shrink-0 text-xs text-zinc-300">{m.label}</div>
                    <div className="flex-1">
                      <div className="h-4 w-full overflow-hidden rounded bg-zinc-900">
                        <div
                          className="h-full bg-rose-500/40 flex items-center justify-end pr-2 text-[10px] font-medium text-rose-200"
                          style={{ width: `${Math.max(m.pct, m.count > 0 ? 6 : 0)}%` }}
                        >
                          {m.count > 0 && `${m.count} · ${m.pct.toFixed(0)}%`}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Performance SDR + Closer */}
          <section className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            <PersonTable title="Performance SDR" stats={sdrStats} accent="sky" />
            <PersonTable title="Performance Closer" stats={closerStats} accent="fuchsia" />
          </section>
        </div>
      </main>
    </>
  );
}

function Kpi({
  label, value, hint, accent = "neutral",
}: {
  label: string;
  value: string;
  hint?: string;
  accent?: "yellow" | "emerald" | "rose" | "neutral";
}) {
  const color =
    accent === "yellow" ? "text-[#f5c518]"
    : accent === "emerald" ? "text-emerald-300"
    : accent === "rose" ? "text-rose-300"
    : "text-zinc-100";
  return (
    <div className="rounded-xl border border-zinc-900 bg-zinc-950/60 p-4">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">{label}</div>
      <div className={`mt-1 text-2xl font-bold ${color}`}>{value}</div>
      {hint && <div className="mt-0.5 text-[10px] text-zinc-600">{hint}</div>}
    </div>
  );
}

function PersonTable({
  title,
  stats,
  accent,
}: {
  title: string;
  stats: { name: string; agendamentos: number; ganhos: number; faturamento: number }[];
  accent: "sky" | "fuchsia";
}) {
  const dot = accent === "sky" ? "bg-sky-400" : "bg-fuchsia-400";
  const fmtBRL = (n: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(n);

  return (
    <div className="rounded-xl border border-zinc-900 bg-zinc-950/60 p-4">
      <h3 className="mb-3 text-sm font-semibold text-zinc-200">{title}</h3>
      {stats.length === 0 ? (
        <p className="text-xs text-zinc-500">Sem dados no período.</p>
      ) : (
        <table className="w-full text-xs">
          <thead>
            <tr className="text-left text-[10px] uppercase tracking-wider text-zinc-500">
              <th className="pb-2 font-medium">Pessoa</th>
              <th className="pb-2 text-right font-medium">Agendou</th>
              <th className="pb-2 text-right font-medium">Ganhou</th>
              <th className="pb-2 text-right font-medium">Faturamento</th>
            </tr>
          </thead>
          <tbody>
            {stats.map((s) => (
              <tr key={s.name} className="border-t border-zinc-900">
                <td className="py-2">
                  <span className="flex items-center gap-1.5">
                    <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
                    {s.name}
                  </span>
                </td>
                <td className="py-2 text-right text-zinc-300">{s.agendamentos}</td>
                <td className="py-2 text-right text-zinc-300">{s.ganhos}</td>
                <td className="py-2 text-right text-emerald-300">{fmtBRL(s.faturamento)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
