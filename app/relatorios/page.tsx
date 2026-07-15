"use client";

import { useMemo } from "react";
import { Download } from "lucide-react";
import { TopBar } from "@/components/layout/TopBar";
import { CreativeBars, MonthlyBars, WeekdayBars } from "@/components/relatorios/ReportCharts";
import { PeriodPicker } from "@/components/ui/PeriodPicker";
import { useMetaSpendContext } from "@/lib/contexts/MetaSpendContext";
import { usePeriodContext } from "@/lib/contexts/PeriodContext";
import { useLeadsContext } from "@/lib/contexts/LeadsContext";
import { cac, custoPorLead, metaLeadsInWindow, metaSpendInWindow } from "@/lib/finance";
import {
  buildCoreKpis,
  buildCreativeStats,
  buildDisqualReasons,
  buildFunnel,
  buildLeadsCsv,
  buildCloserInsights,
  buildLossReasons,
  buildMonthlyStats,
  buildSdrInsights,
  buildSourceStats,
  buildWeekdayStats,
  downloadCsv,
  filterLeadsByRange,
  periodLabel,
  realAdLeadsInRange,
  resolveRange,
} from "@/lib/reports";
import { STATUS_COLORS } from "@/lib/types";

export default function RelatoriosPage() {
  const { leads } = useLeadsContext();
  const { period } = usePeriodContext();
  const { days: metaDays } = useMetaSpendContext();

  const range = useMemo(() => resolveRange(period), [period]);
  const filtered = useMemo(() => filterLeadsByRange(leads, range), [leads, range]);
  // KPIs e performance contam eventos pela DATA DO EVENTO no período (não pela
  // entrada do lead) → usam a lista completa `leads` + o intervalo `range`.
  const kpis = useMemo(() => buildCoreKpis(leads, range), [leads, range]);
  const funnel = useMemo(() => buildFunnel(filtered), [filtered]);
  const lossReasons = useMemo(() => buildLossReasons(filtered), [filtered]);
  const disqualReasons = useMemo(() => buildDisqualReasons(filtered), [filtered]);
  const sdrInsights = useMemo(() => buildSdrInsights(leads, range), [leads, range]);
  const closerInsights = useMemo(() => buildCloserInsights(leads, range), [leads, range]);
  const sourceStats = useMemo(() => buildSourceStats(filtered), [filtered]);
  const monthly = useMemo(() => buildMonthlyStats(leads, 6), [leads]);
  const weekday = useMemo(() => buildWeekdayStats(filtered), [filtered]);
  const creatives = useMemo(() => buildCreativeStats(filtered), [filtered]);

  // Investimento (Meta) + custo de aquisição no período selecionado.
  const finance = useMemo(() => {
    const spend = metaSpendInWindow(metaDays, range.start, range.end);
    const adLeads = metaLeadsInWindow(metaDays, range.start, range.end); // conversas iniciadas (Meta)
    const realLeads = realAdLeadsInRange(leads, range);                  // leads reais no CRM
    return {
      spend,
      adLeads,
      realLeads,
      convRate: adLeads > 0 ? (realLeads / adLeads) * 100 : null,
      cplConversa: custoPorLead(spend, adLeads),
      cplReal: custoPorLead(spend, realLeads),
      cacVal: cac(spend, kpis.ganhos),
    };
  }, [metaDays, range, leads, kpis.ganhos]);

  function exportCsv() {
    const csv = buildLeadsCsv(filtered);
    const date = new Date().toISOString().slice(0, 10);
    downloadCsv(`floow_leads_${date}.csv`, csv);
  }

  const fmtBRL = (n: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(n);
  const fmtPct = (n: number) => `${n.toFixed(1)}%`;

  return (
    <>
      <TopBar title="Relatórios" />

      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-zinc-900 px-4 py-2.5 sm:px-6">
        <div>
          <PeriodPicker />
          <p className="mt-2 text-[11px] text-zinc-500">
            Mostrando <span className="text-zinc-300">{periodLabel(period)}</span> · {filtered.length} leads
          </p>
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
            <Kpi label="Conversão do Closer"   value={fmtPct(kpis.conversionRate)} hint="ganho ÷ reuniões realizadas" accent="emerald" />
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

          {/* Alcance real: conversas iniciadas (Meta) × leads reais (CRM) */}
          <section className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Kpi label="Investido em ads" value={fmtBRL(finance.spend)} hint="gasto na Meta no período" accent="yellow" />
            <Kpi label="Conversas iniciadas (Meta)" value={finance.adLeads.toString()} hint="o que o anúncio reportou" accent="sky" />
            <Kpi label="Leads reais (CRM)" value={finance.realLeads.toString()} hint={finance.convRate != null ? `${finance.convRate.toFixed(0)}% mandaram mensagem` : "quem mandou mensagem"} />
          </section>

          {/* Custo de aquisição — os dois CPLs + CAC */}
          <section className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Kpi label="CPL por conversa" value={finance.cplConversa != null ? fmtBRL(finance.cplConversa) : "—"} hint="investido ÷ conversas (Meta)" />
            <Kpi label="CPL por lead real" value={finance.cplReal != null ? fmtBRL(finance.cplReal) : "—"} hint="investido ÷ leads reais (CRM)" accent="sky" />
            <Kpi label="CAC" value={finance.cacVal != null ? fmtBRL(finance.cacVal) : "—"} hint="investido ÷ clientes ganhos" accent="emerald" />
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

          {/* Por origem (fonte de marketing) */}
          <section className="rounded-xl border border-zinc-900 bg-zinc-950/60 p-4">
            <h3 className="mb-3 text-sm font-semibold text-zinc-200">Por origem (fonte)</h3>
            {sourceStats.length === 0 ? (
              <p className="text-xs text-zinc-500">Sem dados no período.</p>
            ) : (
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left text-[10px] uppercase tracking-wider text-zinc-500">
                    <th className="pb-2 font-medium">Origem</th>
                    <th className="pb-2 text-right font-medium">Leads</th>
                    <th className="pb-2 text-right font-medium">Qualif.</th>
                    <th className="pb-2 text-right font-medium">Agendou</th>
                    <th className="pb-2 text-right font-medium">Ganhou</th>
                    <th className="pb-2 text-right font-medium">Conversão</th>
                    <th className="pb-2 text-right font-medium">Faturamento</th>
                  </tr>
                </thead>
                <tbody>
                  {sourceStats.map((s) => (
                    <tr key={s.key} className="border-t border-zinc-900">
                      <td className="py-2 text-zinc-200">{s.label}</td>
                      <td className="py-2 text-right text-zinc-300">{s.leads}</td>
                      <td className="py-2 text-right text-zinc-300">{s.qualificados}</td>
                      <td className="py-2 text-right text-zinc-300">{s.agendamentos}</td>
                      <td className="py-2 text-right text-zinc-300">{s.ganhos}</td>
                      <td className="py-2 text-right text-[#f5c518]">{fmtPct(s.convRate)}</td>
                      <td className="py-2 text-right text-emerald-300">{fmtBRL(s.faturamento)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
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

          {/* Motivos de desqualificação */}
          {disqualReasons.length > 0 && (
            <section className="rounded-xl border border-zinc-900 bg-zinc-950/60 p-4">
              <h3 className="mb-3 text-sm font-semibold text-zinc-200">Motivos de desqualificação</h3>
              <div className="space-y-2">
                {disqualReasons.map((m) => (
                  <div key={m.motivo} className="flex items-center gap-3">
                    <div className="w-40 shrink-0 text-xs text-zinc-300">{m.label}</div>
                    <div className="flex-1">
                      <div className="h-4 w-full overflow-hidden rounded bg-zinc-900">
                        <div
                          className="h-full bg-slate-400/40 flex items-center justify-end pr-2 text-[10px] font-medium text-slate-200"
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

          {/* Insights do SDR — cards visuais */}
          <section>
            <div className="mb-2 flex items-baseline justify-between">
              <h3 className="text-sm font-semibold text-zinc-200">Insights do SDR</h3>
              <span className="text-[11px] text-zinc-500">agendou → compareceu → no-show</span>
            </div>
            {sdrInsights.length === 0 ? (
              <p className="rounded-xl border border-zinc-900 bg-zinc-950/60 p-4 text-xs text-zinc-500">Sem atividade de SDR no período.</p>
            ) : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {sdrInsights.map((s) => {
                  const pend = Math.max(0, s.agendadas - s.realizadas - s.noShow);
                  return (
                    <div key={s.name} className="rounded-xl border border-zinc-900 bg-zinc-950/60 p-4">
                      <div className="mb-3 flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full bg-sky-400" />
                        <span className="text-sm font-semibold text-zinc-100">{s.name}</span>
                      </div>
                      <div className="mb-3 grid grid-cols-3 gap-2">
                        <StatMini label="Agendadas" value={s.agendadas} color="text-zinc-100" />
                        <StatMini label="Realizadas" value={s.realizadas} color="text-emerald-300" />
                        <StatMini label="No-show" value={s.noShow} color="text-amber-300" />
                      </div>
                      <SegBar
                        total={s.agendadas}
                        segs={[
                          { value: s.realizadas, cls: "bg-emerald-500", label: "Realizadas" },
                          { value: s.noShow, cls: "bg-amber-500", label: "No-show" },
                          { value: pend, cls: "bg-zinc-700", label: "Aguardando" },
                        ]}
                      />
                      <Meter label="Comparecimento" pct={s.comparecimento} />
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* Insights do Closer — cards visuais */}
          <section>
            <div className="mb-2 flex items-baseline justify-between">
              <h3 className="text-sm font-semibold text-zinc-200">Insights do Closer</h3>
              <span className="text-[11px] text-zinc-500">conversão = ganho ÷ reuniões realizadas</span>
            </div>
            {closerInsights.length === 0 ? (
              <p className="rounded-xl border border-zinc-900 bg-zinc-950/60 p-4 text-xs text-zinc-500">Sem atividade de Closer no período.</p>
            ) : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {closerInsights.map((c) => {
                  const emAberto = Math.max(0, c.realizadas - c.ganhos - c.perdidos);
                  return (
                    <div key={c.name} className="rounded-xl border border-zinc-900 bg-zinc-950/60 p-4">
                      <div className="mb-3 flex items-center justify-between gap-2">
                        <span className="flex items-center gap-2">
                          <span className="h-2 w-2 rounded-full bg-fuchsia-400" />
                          <span className="text-sm font-semibold text-zinc-100">{c.name}</span>
                        </span>
                        <span className="text-sm font-bold tabular-nums text-emerald-300">{fmtBRL(c.faturamento)}</span>
                      </div>
                      <div className="mb-3 grid grid-cols-4 gap-2">
                        <StatMini label="Realizadas" value={c.realizadas} color="text-zinc-100" />
                        <StatMini label="Ganhos" value={c.ganhos} color="text-emerald-300" />
                        <StatMini label="Perdidos" value={c.perdidos} color="text-rose-300" />
                        <StatMini label="No-show" value={c.noShow} color="text-amber-300" />
                      </div>
                      <SegBar
                        total={c.realizadas}
                        segs={[
                          { value: c.ganhos, cls: "bg-emerald-500", label: "Ganhos" },
                          { value: c.perdidos, cls: "bg-rose-500", label: "Perdidos" },
                          { value: emAberto, cls: "bg-zinc-700", label: "Em aberto" },
                        ]}
                      />
                      <Meter label="Conversão" pct={c.conversao} />
                    </div>
                  );
                })}
              </div>
            )}
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
  accent?: "yellow" | "emerald" | "rose" | "sky" | "neutral";
}) {
  const color =
    accent === "yellow" ? "text-[#f5c518]"
    : accent === "emerald" ? "text-emerald-300"
    : accent === "rose" ? "text-rose-300"
    : accent === "sky" ? "text-sky-300"
    : "text-zinc-100";
  return (
    <div className="rounded-xl border border-zinc-900 bg-zinc-950/60 p-4">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">{label}</div>
      <div className={`mt-1 text-2xl font-bold ${color}`}>{value}</div>
      {hint && <div className="mt-0.5 text-[10px] text-zinc-600">{hint}</div>}
    </div>
  );
}

// Tile de número compacto (dentro dos cards de insight).
function StatMini({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="rounded-lg border border-zinc-900 bg-zinc-900/40 px-1 py-2 text-center">
      <div className={`text-xl font-bold tabular-nums ${color}`}>{value}</div>
      <div className="mt-0.5 text-[9px] font-medium uppercase tracking-wide text-zinc-500">{label}</div>
    </div>
  );
}

// Barra segmentada (funil): mostra a composição de um total em fatias coloridas.
function SegBar({ total, segs }: { total: number; segs: { value: number; cls: string; label: string }[] }) {
  const t = total || 1;
  const shown = segs.filter((s) => s.value > 0);
  return (
    <div>
      <div className="flex h-2.5 w-full gap-px overflow-hidden rounded-full bg-zinc-900">
        {segs.map((s, i) =>
          s.value > 0 ? (
            <div key={i} className={s.cls} style={{ width: `${(s.value / t) * 100}%` }} title={`${s.label}: ${s.value}`} />
          ) : null,
        )}
      </div>
      {shown.length > 0 && (
        <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1">
          {shown.map((s, i) => (
            <span key={i} className="flex items-center gap-1 text-[10px] text-zinc-400">
              <span className={`h-1.5 w-1.5 rounded-full ${s.cls}`} />
              {s.label} <span className="tabular-nums text-zinc-300">{s.value}</span>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// Medidor de porcentagem com barra de progresso.
function Meter({ label, pct }: { label: string; pct: number }) {
  return (
    <div className="mt-3">
      <div className="mb-1 flex items-baseline justify-between">
        <span className="text-[11px] font-medium text-zinc-400">{label}</span>
        <span className="text-sm font-bold tabular-nums text-[#f5c518]">{pct.toFixed(0)}%</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-900">
        <div className="h-full rounded-full bg-[#f5c518]" style={{ width: `${Math.min(100, Math.max(0, pct))}%` }} />
      </div>
    </div>
  );
}
