"use client";

import { useMemo } from "react";
import { TopBar } from "@/components/layout/TopBar";
import { MetaRing } from "@/components/dashboard/MetaRing";
import { Funnel } from "@/components/dashboard/Funnel";
import { UpcomingMeetings } from "@/components/dashboard/UpcomingMeetings";
import { useLeadsContext } from "@/lib/contexts/LeadsContext";
import { useGoalsContext } from "@/lib/contexts/GoalsContext";
import { useAdInvestmentsContext } from "@/lib/contexts/AdInvestmentsContext";
import { adLeadsInWindow, cac, custoPorLead, spendInWindow } from "@/lib/finance";
import { PIPELINE_STATUSES, type Lead, type Owner } from "@/lib/types";

function startOfIsoWeek(d: Date) {
  const x = new Date(d);
  const day = x.getDay();
  const diff = (day === 0 ? -6 : 1) - day;
  x.setDate(x.getDate() + diff);
  x.setHours(0, 0, 0, 0);
  return x;
}

function startOfMonth(d: Date) {
  const x = new Date(d);
  x.setDate(1);
  x.setHours(0, 0, 0, 0);
  return x;
}

// Contagem estável usando agendado_em / ganho_em (one-shot na transição).
// Agendou hoje → conta hoje pra sempre; ganhou hoje → conta hoje pra sempre.
function countWeekMonth(leads: Lead[], owner: Owner) {
  const week = startOfIsoWeek(new Date());
  const month = startOfMonth(new Date());
  let w = 0, m = 0;
  for (const l of leads) {
    if (l.dono !== owner) continue;
    const tsField = owner === "SDR" ? l.agendado_em : l.ganho_em;
    if (!tsField) continue;
    const ref = new Date(tsField);
    if (ref >= week) w++;
    if (ref >= month) m++;
  }
  return { week: w, month: m };
}

function pipelineValue(leads: Lead[]) {
  let total = 0;
  for (const l of leads) {
    if (!PIPELINE_STATUSES.includes(l.status)) continue; // só Qualificado→Carteira
    if (l.valor) total += Number(l.valor);
  }
  return total;
}

function wonValueMonth(leads: Lead[]) {
  const month = startOfMonth(new Date());
  let total = 0;
  for (const l of leads) {
    if (!l.ganho_em) continue;
    if (new Date(l.ganho_em) < month) continue;
    if (l.valor) total += Number(l.valor);
  }
  return total;
}

export default function DashboardPage() {
  const { leads } = useLeadsContext();
  const { goals } = useGoalsContext();
  const { investments } = useAdInvestmentsContext();

  const sdr = useMemo(() => countWeekMonth(leads, "SDR"), [leads]);
  const closer = useMemo(() => countWeekMonth(leads, "Closer"), [leads]);
  const pipeline = useMemo(() => pipelineValue(leads), [leads]);
  const wonMonth = useMemo(() => wonValueMonth(leads), [leads]);

  // Custo de aquisição no mês corrente (investimento de ads ÷ resultados).
  const aquisicao = useMemo(() => {
    const monthStart = startOfMonth(new Date());
    const now = new Date();
    const spend = spendInWindow(investments, monthStart, now);
    const adLeads = adLeadsInWindow(investments, monthStart, now);
    const ganhosMes = leads.filter((l) => l.ganho_em && new Date(l.ganho_em) >= monthStart).length;
    return { spend, cpl: custoPorLead(spend, adLeads), cacVal: cac(spend, ganhosMes) };
  }, [investments, leads]);

  const sdrWeekly = goals.SDR?.weekly_goal ?? 0;
  const sdrMonthly = sdrWeekly * 4;
  const closerWeekly = goals.Closer?.weekly_goal ?? 0;
  const closerMonthly = closerWeekly * 4;

  const fmtBRL = (n: number) =>
    new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
      maximumFractionDigits: 0,
    }).format(n);

  return (
    <>
      <TopBar title="Dashboard" />
      <main className="flex-1 overflow-y-auto px-4 py-6 sm:px-6">
        {/* Metas SDR + Closer */}
        <section className="mb-6 grid grid-cols-1 gap-3 lg:grid-cols-2">
          <OwnerCard
            owner="SDR"
            metricLabel="Agendamentos"
            weekly={{ current: sdr.week, target: sdrWeekly }}
            monthly={{ current: sdr.month, target: sdrMonthly }}
            accent="#38bdf8"
          />
          <OwnerCard
            owner="Closer"
            metricLabel="Fechamentos"
            weekly={{ current: closer.week, target: closerWeekly }}
            monthly={{ current: closer.month, target: closerMonthly }}
            accent="#e879f9"
          />
        </section>

        {/* Pipeline + Faturamento */}
        <section className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <BigStat
            label="Pipeline ativo"
            value={fmtBRL(pipeline)}
            hint="valor total de leads em andamento"
            accent="#f5c518"
          />
          <BigStat
            label="Fechado este mês"
            value={fmtBRL(wonMonth)}
            hint="negócios ganhos no mês corrente"
            accent="#34d399"
          />
        </section>

        {/* Custo de aquisição (mês) */}
        <section className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <BigStat label="Investido em ads" value={fmtBRL(aquisicao.spend)} hint="ads no mês corrente" accent="#f5c518" />
          <BigStat
            label="Custo por lead"
            value={aquisicao.cpl != null ? fmtBRL(aquisicao.cpl) : "—"}
            hint="investido ÷ leads dos anúncios"
            accent="#38bdf8"
          />
          <BigStat
            label="CAC"
            value={aquisicao.cacVal != null ? fmtBRL(aquisicao.cacVal) : "—"}
            hint="investido ÷ clientes ganhos"
            accent="#34d399"
          />
        </section>

        {/* Funil + Próximas reuniões */}
        <section className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          <Funnel leads={leads} />
          <UpcomingMeetings leads={leads} />
        </section>
      </main>
    </>
  );
}

function OwnerCard({
  owner,
  metricLabel,
  weekly,
  monthly,
  accent,
}: {
  owner: Owner;
  metricLabel: string;
  weekly: { current: number; target: number };
  monthly: { current: number; target: number };
  accent: string;
}) {
  return (
    <div className="rounded-2xl border border-zinc-900 bg-zinc-950/60 p-5">
      <div className="mb-5 flex items-center gap-2">
        <span
          className="h-2.5 w-2.5 rounded-full"
          style={{ backgroundColor: accent }}
        />
        <h2 className="text-base font-bold text-zinc-100">{owner}</h2>
        <span className="text-xs text-zinc-500">· {metricLabel}</span>
      </div>

      <div className="flex items-center justify-around gap-4">
        <MetaRing
          label="Semana"
          current={weekly.current}
          target={weekly.target}
          accent={accent}
        />
        <MetaRing
          label="Mês"
          current={monthly.current}
          target={monthly.target}
          accent={accent}
        />
      </div>
    </div>
  );
}

function BigStat({
  label,
  value,
  hint,
  accent,
}: {
  label: string;
  value: string;
  hint?: string;
  accent: string;
}) {
  return (
    <div className="rounded-2xl border border-zinc-900 bg-zinc-950/60 p-5">
      <div className="flex items-center gap-2">
        <span
          className="h-2 w-2 rounded-full"
          style={{ backgroundColor: accent }}
        />
        <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
          {label}
        </span>
      </div>
      <div
        className="mt-3 text-3xl font-bold sm:text-4xl"
        style={{ color: accent }}
      >
        {value}
      </div>
      {hint && <div className="mt-1 text-[11px] text-zinc-500">{hint}</div>}
    </div>
  );
}
