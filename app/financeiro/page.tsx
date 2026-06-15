"use client";

import { useMemo, useState } from "react";
import { endOfMonth, format, parseISO, startOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { DollarSign, Plus, Target, Trash2, TrendingUp, Users } from "lucide-react";
import { TopBar } from "@/components/layout/TopBar";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { InvestmentDialog } from "@/components/financeiro/InvestmentDialog";
import { useAdInvestmentsContext } from "@/lib/contexts/AdInvestmentsContext";
import { useLeadsContext } from "@/lib/contexts/LeadsContext";
import { useTeamContext } from "@/lib/contexts/TeamContext";
import { adLeadsInWindow, cac, coveredDays, custoPorLead, periodDays, spendInWindow, totalAdLeads, totalSpend } from "@/lib/finance";

const fmtBRL = (n: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(n);

export default function FinanceiroPage() {
  const { isAdmin, isTraffic } = useTeamContext();
  const { leads } = useLeadsContext();
  const { investments, createInvestment, deleteInvestment } = useAdInvestmentsContext();
  const [dialog, setDialog] = useState(false);

  const canManage = isAdmin || isTraffic;

  const covered = useMemo(() => coveredDays(investments), [investments]);

  const month = useMemo(() => {
    const start = startOfMonth(new Date());
    const end = endOfMonth(new Date());
    const spend = spendInWindow(investments, start, end);
    const adLeads = adLeadsInWindow(investments, start, end);
    const ganhos = leads.filter(
      (l) => l.ganho_em && new Date(l.ganho_em).getTime() >= start.getTime() && new Date(l.ganho_em).getTime() <= end.getTime(),
    ).length;
    return { spend, adLeads, ganhos, cpl: custoPorLead(spend, adLeads), cacVal: cac(spend, ganhos) };
  }, [investments, leads]);

  if (!canManage) {
    return (
      <>
        <TopBar title="Financeiro" />
        <main className="flex flex-1 items-center justify-center p-6">
          <p className="max-w-sm text-center text-sm text-zinc-500">
            O Financeiro é gerenciado pelo administrador e pelo gestor de tráfego.
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
          {/* Ação principal */}
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-zinc-200">Investimento em ads</h2>
              <p className="text-xs text-zinc-500">Lance o gasto por período. Os dias já lançados ficam travados.</p>
            </div>
            <button
              onClick={() => setDialog(true)}
              className="flex items-center gap-1.5 rounded-md bg-[#f5c518] px-3 py-2 text-xs font-semibold text-zinc-950 hover:bg-[#ffd633]"
            >
              <Plus size={14} strokeWidth={2.5} />
              Lançar investimento da semana
            </button>
          </div>

          {/* Visão do mês */}
          <div>
            <div className="mb-2 text-[11px] font-medium uppercase tracking-wider text-zinc-500">
              Este mês · {format(new Date(), "MMMM yyyy", { locale: ptBR })}
            </div>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <KpiCard icon={DollarSign} label="Investido" value={fmtBRL(month.spend)} accent="yellow" />
              <KpiCard icon={Users} label="Leads dos anúncios" value={month.adLeads} accent="sky" />
              <KpiCard
                icon={TrendingUp}
                label="Custo por lead"
                value={month.cpl != null ? fmtBRL(month.cpl) : "—"}
                sub="investido ÷ leads dos anúncios"
                accent="neutral"
              />
              <KpiCard
                icon={Target}
                label="CAC"
                value={month.cacVal != null ? fmtBRL(month.cacVal) : "—"}
                sub={`${month.ganhos} ganho${month.ganhos === 1 ? "" : "s"} no mês`}
                accent="emerald"
              />
            </div>
          </div>

          {/* Histórico de lançamentos */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <div className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">
                Lançamentos
              </div>
              <div className="text-[11px] text-zinc-500">
                {totalAdLeads(investments)} leads · {fmtBRL(totalSpend(investments))}
              </div>
            </div>
            <div className="overflow-hidden rounded-xl border border-zinc-900">
              {investments.length === 0 ? (
                <div className="px-4 py-8 text-center text-sm text-zinc-600">
                  Nenhum investimento lançado ainda.
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-zinc-900 text-left text-[11px] uppercase tracking-wider text-zinc-500">
                      <th className="px-4 py-2 font-medium">Período</th>
                      <th className="px-4 py-2 font-medium">Dias</th>
                      <th className="px-4 py-2 text-right font-medium">Leads</th>
                      <th className="px-4 py-2 font-medium">Canal</th>
                      <th className="px-4 py-2 text-right font-medium">Valor</th>
                      <th className="px-4 py-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {investments.map((inv) => (
                      <tr key={inv.id} className="border-b border-zinc-900/60 last:border-0">
                        <td className="px-4 py-2.5 text-zinc-200">
                          {format(parseISO(inv.periodo_inicio), "d MMM", { locale: ptBR })} –{" "}
                          {format(parseISO(inv.periodo_fim), "d MMM yyyy", { locale: ptBR })}
                        </td>
                        <td className="px-4 py-2.5 text-zinc-400">{periodDays(inv.periodo_inicio, inv.periodo_fim)}</td>
                        <td className="px-4 py-2.5 text-right text-zinc-300">{inv.leads_ads}</td>
                        <td className="px-4 py-2.5 text-zinc-400">{inv.canal ?? "—"}</td>
                        <td className="px-4 py-2.5 text-right font-medium text-zinc-100">{fmtBRL(inv.valor)}</td>
                        <td className="px-4 py-2.5 text-right">
                          <button
                            onClick={async () => {
                              if (confirm("Remover este lançamento?")) await deleteInvestment(inv.id);
                            }}
                            className="text-zinc-600 hover:text-rose-400"
                            aria-label="Remover"
                          >
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      </main>

      <InvestmentDialog
        open={dialog}
        covered={covered}
        onClose={() => setDialog(false)}
        onSubmit={createInvestment}
      />
    </>
  );
}
