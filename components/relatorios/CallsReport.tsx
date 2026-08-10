"use client";

import { useEffect, useMemo, useState } from "react";
import { Phone } from "lucide-react";
import { getSupabase } from "@/lib/supabase/client";
import { buildCallStats, type CallEventLite, type ResolvedRange } from "@/lib/reports";
import { CALL_OUTCOME_LABELS, type Lead } from "@/lib/types";

// Cores por resultado.
const OUTCOME_STYLE: Record<string, { bar: string; text: string }> = {
  atendeu: { bar: "bg-emerald-400", text: "text-emerald-300" },
  rejeitou: { bar: "bg-rose-400", text: "text-rose-300" },
  chamou_ate_cair: { bar: "bg-amber-400", text: "text-amber-300" },
  nao_chamou: { bar: "bg-zinc-500", text: "text-zinc-400" },
};
const OUTCOME_ORDER = ["atendeu", "rejeitou", "chamou_ate_cair", "nao_chamou"] as const;

export function CallsReport({ leads, range }: { leads: Lead[]; range: ResolvedRange }) {
  const [events, setEvents] = useState<CallEventLite[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      const { data } = await getSupabase()
        .from("lead_events")
        .select("lead_id, actor_name, created_at, payload")
        .eq("tipo", "ligacao")
        .order("created_at", { ascending: false })
        .limit(5000);
      if (alive) {
        setEvents((data as CallEventLite[]) ?? []);
        setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  const s = useMemo(() => buildCallStats(events, leads, range), [events, leads, range]);
  const maxDay = useMemo(() => Math.max(1, ...s.byDay.map((d) => d.total)), [s]);

  return (
    <section>
      <div className="mb-2 flex items-baseline justify-between">
        <h3 className="flex items-center gap-1.5 text-sm font-semibold text-zinc-200">
          <Phone size={14} className="text-[#f5c518]" /> Ligações — desempenho por SDR
        </h3>
        <span className="text-[11px] text-zinc-500">do histórico de ligações</span>
      </div>

      {loading ? (
        <div className="rounded-xl border border-zinc-900 bg-zinc-950/60 p-4 text-xs text-zinc-500">Carregando…</div>
      ) : s.total === 0 ? (
        <div className="rounded-xl border border-zinc-900 bg-zinc-950/60 p-4 text-xs text-zinc-500">
          Nenhuma ligação registrada no período. As ligações são registradas pela extensão (botão “Ligar pelo WhatsApp”).
        </div>
      ) : (
        <div className="space-y-3">
          {/* Cards de visão geral */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <Stat label="Ligações" value={s.total} accent="text-zinc-100" />
            <Stat label="Taxa de atendimento" value={`${Math.round(s.taxaAtendimento)}%`} accent="text-emerald-300" />
            <Stat label="Média / dia" value={s.mediaPorDia.toFixed(1)} accent="text-zinc-100" />
            <Stat label="Leads ligados" value={s.leadsUnicos} accent="text-sky-300" />
            <Stat label="…que agendaram" value={s.leadsAgendados} accent="text-fuchsia-300" />
            <Stat label="…que fecharam" value={s.leadsGanhos} accent="text-emerald-300" />
          </div>

          {/* Distribuição por resultado */}
          <div className="rounded-xl border border-zinc-900 bg-zinc-950/60 p-4">
            <div className="mb-2 text-xs font-semibold text-zinc-300">Resultado das ligações</div>
            <div className="space-y-1.5">
              {OUTCOME_ORDER.map((k) => {
                const v = s[k] as number;
                const pct = s.total > 0 ? (v / s.total) * 100 : 0;
                const st = OUTCOME_STYLE[k];
                return (
                  <div key={k} className="flex items-center gap-2">
                    <span className="w-28 shrink-0 text-xs text-zinc-400">{CALL_OUTCOME_LABELS[k as keyof typeof CALL_OUTCOME_LABELS]}</span>
                    <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-zinc-900">
                      <div className={`h-full rounded-full ${st.bar}`} style={{ width: `${pct}%` }} />
                    </div>
                    <span className={`w-16 text-right text-xs tabular-nums ${st.text}`}>{v} · {Math.round(pct)}%</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Tabela por SDR */}
          <div className="overflow-x-auto rounded-xl border border-zinc-900 bg-zinc-950/60 p-4">
            <table className="w-full min-w-[560px] text-xs">
              <thead>
                <tr className="text-left text-[10px] uppercase tracking-wider text-zinc-500">
                  <th className="pb-2 font-medium">SDR</th>
                  <th className="pb-2 text-right font-medium">Ligações</th>
                  <th className="pb-2 text-right font-medium">Atendeu</th>
                  <th className="pb-2 text-right font-medium">Rejeitou</th>
                  <th className="pb-2 text-right font-medium">Chamou até cair</th>
                  <th className="pb-2 text-right font-medium">Não chamou</th>
                  <th className="pb-2 text-right font-medium">Taxa atend.</th>
                  <th className="pb-2 text-right font-medium">Leads</th>
                </tr>
              </thead>
              <tbody>
                {s.perSdr.map((r) => (
                  <tr key={r.name} className="border-t border-zinc-900">
                    <td className="py-2 font-medium text-zinc-200">{r.name}</td>
                    <td className="py-2 text-right font-semibold tabular-nums text-zinc-100">{r.total}</td>
                    <td className="py-2 text-right tabular-nums text-emerald-300">{r.atendeu}</td>
                    <td className="py-2 text-right tabular-nums text-rose-300">{r.rejeitou}</td>
                    <td className="py-2 text-right tabular-nums text-amber-300">{r.chamou_ate_cair}</td>
                    <td className="py-2 text-right tabular-nums text-zinc-400">{r.nao_chamou}</td>
                    <td className="py-2 text-right font-semibold tabular-nums text-emerald-300">{Math.round(r.taxaAtendimento)}%</td>
                    <td className="py-2 text-right tabular-nums text-sky-300">{r.leadsUnicos}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Ligações por dia */}
          {s.byDay.length > 1 && (
            <div className="rounded-xl border border-zinc-900 bg-zinc-950/60 p-4">
              <div className="mb-2 text-xs font-semibold text-zinc-300">Ligações por dia</div>
              <div className="flex items-end gap-1" style={{ height: 90 }}>
                {s.byDay.map((d) => (
                  <div key={d.day} className="flex flex-1 flex-col items-center gap-1" title={`${d.label}: ${d.total} ligações · ${d.atendeu} atendidas`}>
                    <div className="flex w-full flex-col justify-end overflow-hidden rounded-t bg-zinc-900" style={{ height: 70 }}>
                      <div className="w-full bg-emerald-400/80" style={{ height: `${(d.atendeu / maxDay) * 70}px` }} />
                      <div className="w-full bg-[#f5c518]/70" style={{ height: `${((d.total - d.atendeu) / maxDay) * 70}px` }} />
                    </div>
                    <span className="text-[9px] text-zinc-600">{d.label}</span>
                  </div>
                ))}
              </div>
              <div className="mt-2 flex gap-3 text-[10px] text-zinc-500">
                <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-emerald-400/80" /> atendidas</span>
                <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-[#f5c518]/70" /> demais</span>
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function Stat({ label, value, accent }: { label: string; value: string | number; accent: string }) {
  return (
    <div className="rounded-xl border border-zinc-900 bg-zinc-950/60 p-3">
      <div className={`text-lg font-bold tabular-nums ${accent}`}>{value}</div>
      <div className="text-[10px] leading-tight text-zinc-500">{label}</div>
    </div>
  );
}
