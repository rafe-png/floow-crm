"use client";

import { useMemo } from "react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { DollarSign, Megaphone, Percent, PiggyBank, RefreshCw, Target, TrendingUp, Trophy, Users } from "lucide-react";
import { TopBar } from "@/components/layout/TopBar";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { PeriodPicker } from "@/components/ui/PeriodPicker";
import { useMetaSpendContext } from "@/lib/contexts/MetaSpendContext";
import { usePeriodContext } from "@/lib/contexts/PeriodContext";
import { useLeadsContext } from "@/lib/contexts/LeadsContext";
import { useTeamContext } from "@/lib/contexts/TeamContext";
import { cac, custoPorLead, metaLeadsInWindow, metaSpendInWindow } from "@/lib/finance";
import { faturamentoInRange, ganhosInRange, periodLabel, realAdLeadsInRange, resolveRange } from "@/lib/reports";
import { PIPELINE_STATUSES } from "@/lib/types";

const fmtBRL = (n: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(n);
const fmtBRL2 = (n: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2 }).format(n);

export default function FinanceiroPage() {
  const { isAdmin } = useTeamContext();
  const { leads } = useLeadsContext();
  const { period } = usePeriodContext();
  const { days: metaDays, sync, syncing, syncError, lastSync } = useMetaSpendContext();

  // Financeiro é exclusivo do ADM.
  const canManage = isAdmin;

  const view = useMemo(() => {
    const range = resolveRange(period);
    const spend = metaSpendInWindow(metaDays, range.start, range.end);
    const adLeads = metaLeadsInWindow(metaDays, range.start, range.end); // conversas iniciadas (Meta)
    const realLeads = realAdLeadsInRange(leads, range);                  // leads reais no CRM (Meta Ads)
    const convRate = adLeads > 0 ? (realLeads / adLeads) * 100 : null;   // % que virou lead trabalhável
    const faturamento = faturamentoInRange(leads, range);
    const ganhos = ganhosInRange(leads, range);
    const lucro = faturamento - spend;
    const roas = spend > 0 ? faturamento / spend : null; // retorno por R$ investido
    const ticket = ganhos > 0 ? faturamento / ganhos : 0;
    const pipeline = leads
      .filter((l) => PIPELINE_STATUSES.includes(l.status) && l.valor)
      .reduce((acc, l) => acc + Number(l.valor), 0);
    // Dias com gasto no intervalo (pra tabela dia a dia).
    const endKey = range.end.toISOString().slice(0, 10);
    const startKey = range.start ? range.start.toISOString().slice(0, 10) : null;
    const dias = metaDays
      .filter((d) => (!startKey || d.day >= startKey) && d.day <= endKey && (d.spend > 0 || d.leads > 0))
      .sort((a, b) => b.day.localeCompare(a.day));
    return {
      spend, adLeads, realLeads, convRate, faturamento, ganhos, lucro, roas, ticket, pipeline,
      cplConversa: custoPorLead(spend, adLeads),  // investido ÷ conversas iniciadas
      cplReal: custoPorLead(spend, realLeads),    // investido ÷ leads reais
      cacVal: cac(spend, ganhos),
      dias,
    };
  }, [metaDays, leads, period]);

  if (!canManage) {
    return (
      <>
        <TopBar title="Financeiro" />
        <main className="flex flex-1 items-center justify-center p-6">
          <p className="max-w-sm text-center text-sm text-zinc-500">
            O Financeiro é exclusivo do administrador.
          </p>
        </main>
      </>
    );
  }

  return (
    <>
      <TopBar title="Financeiro" />

      <main className="flex-1 overflow-y-auto p-4 sm:p-6">
        <div className="mx-auto max-w-5xl space-y-6">
          {/* Período + sincronização */}
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <PeriodPicker />
              <p className="mt-2 text-[11px] text-zinc-500">
                Mostrando <span className="text-zinc-300">{periodLabel(period)}</span>
                {lastSync && (
                  <> · dados da Meta atualizados {format(parseISO(lastSync), "d MMM 'às' HH:mm", { locale: ptBR })}</>
                )}
              </p>
            </div>
            <button
              onClick={() => sync(365)}
              disabled={syncing}
              className="flex items-center gap-1.5 rounded-md bg-[#f5c518] px-3 py-2 text-xs font-semibold text-zinc-950 hover:bg-[#ffd633] disabled:opacity-60"
            >
              <RefreshCw size={14} className={syncing ? "animate-spin" : ""} />
              {syncing ? "Sincronizando…" : "Sincronizar com a Meta"}
            </button>
          </div>

          {syncError && (
            <div className="rounded-md border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-300">
              {syncError}
            </div>
          )}

          {/* Resultado do período */}
          <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <KpiCard icon={Megaphone} label="Investido em ads" value={fmtBRL2(view.spend)} sub="gasto na Meta (automático)" accent="yellow" />
            <KpiCard icon={Trophy} label="Faturamento" value={fmtBRL2(view.faturamento)} sub={`${view.ganhos} negócio${view.ganhos === 1 ? "" : "s"} ganho${view.ganhos === 1 ? "" : "s"}`} accent="emerald" />
            <KpiCard icon={PiggyBank} label="Lucro (fat. − ads)" value={fmtBRL2(view.lucro)} sub="faturamento menos investimento" accent={view.lucro >= 0 ? "emerald" : "neutral"} />
            <KpiCard icon={Percent} label="ROAS" value={view.roas != null ? `${view.roas.toFixed(2)}x` : "—"} sub="retorno por R$ investido" accent="sky" />
          </section>

          {/* Alcance real: conversas iniciadas (Meta) × leads reais (CRM) */}
          <section className="grid grid-cols-2 gap-3 lg:grid-cols-3">
            <KpiCard icon={Megaphone} label="Conversas iniciadas (Meta)" value={view.adLeads} sub="o que o anúncio reportou" accent="sky" />
            <KpiCard icon={Users} label="Leads reais (CRM)" value={view.realLeads} sub={view.convRate != null ? `${view.convRate.toFixed(0)}% mandaram mensagem` : "quem mandou mensagem"} accent="yellow" />
            <KpiCard icon={Trophy} label="Clientes ganhos" value={view.ganhos} sub="fecharam no período" accent="emerald" />
          </section>

          {/* Eficiência de aquisição — os dois CPLs + CAC + ticket */}
          <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <KpiCard icon={TrendingUp} label="CPL por conversa" value={view.cplConversa != null ? fmtBRL(view.cplConversa) : "—"} sub="investido ÷ conversas (Meta)" accent="neutral" />
            <KpiCard icon={TrendingUp} label="CPL por lead real" value={view.cplReal != null ? fmtBRL(view.cplReal) : "—"} sub="investido ÷ leads reais (CRM)" accent="sky" />
            <KpiCard icon={Target} label="CAC" value={view.cacVal != null ? fmtBRL(view.cacVal) : "—"} sub="investido ÷ clientes ganhos" accent="neutral" />
            <KpiCard icon={DollarSign} label="Ticket médio" value={fmtBRL(view.ticket)} sub="faturamento ÷ ganhos" accent="emerald" />
          </section>

          {/* Pipeline em aberto (foto do momento, não depende do período) */}
          <section className="grid grid-cols-1 gap-3">
            <KpiCard icon={DollarSign} label="Pipeline ativo (agora)" value={fmtBRL(view.pipeline)} sub="valor dos leads em andamento — foto do momento" accent="yellow" />
          </section>

          {/* Gasto dia a dia */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <div className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">
                Gasto por dia (Meta)
              </div>
              <div className="text-[11px] text-zinc-500">{view.dias.length} dia{view.dias.length === 1 ? "" : "s"} com gasto</div>
            </div>
            <div className="overflow-hidden rounded-xl border border-zinc-900">
              {view.dias.length === 0 ? (
                <div className="px-4 py-8 text-center text-sm text-zinc-600">
                  Sem gasto de anúncios nesse período. Clique em <strong>Sincronizar com a Meta</strong> se achar que falta dado.
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-zinc-900 text-left text-[11px] uppercase tracking-wider text-zinc-500">
                      <th className="px-4 py-2 font-medium">Dia</th>
                      <th className="px-4 py-2 text-right font-medium">Conversas</th>
                      <th className="px-4 py-2 text-right font-medium">Cliques</th>
                      <th className="px-4 py-2 text-right font-medium">Gasto</th>
                    </tr>
                  </thead>
                  <tbody>
                    {view.dias.map((d) => (
                      <tr key={d.day} className="border-b border-zinc-900/60 last:border-0">
                        <td className="px-4 py-2.5 text-zinc-200">
                          {format(parseISO(d.day), "EEE, d MMM", { locale: ptBR })}
                        </td>
                        <td className="px-4 py-2.5 text-right text-zinc-300">{d.leads}</td>
                        <td className="px-4 py-2.5 text-right text-zinc-400">{d.clicks}</td>
                        <td className="px-4 py-2.5 text-right font-medium text-zinc-100">{fmtBRL2(Number(d.spend))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
