"use client";

import { useMemo } from "react";
import { Layers, Users } from "lucide-react";
import { buildSegmentStats, buildProfileStats } from "@/lib/reports";
import type { Lead } from "@/lib/types";

const fmtBRL = (n: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(n);

export function SegmentReport({ leads }: { leads: Lead[] }) {
  const segments = useMemo(() => buildSegmentStats(leads), [leads]);
  const profile = useMemo(() => buildProfileStats(leads), [leads]);
  const maxSeg = useMemo(() => Math.max(1, ...segments.map((s) => s.leads)), [segments]);

  return (
    <>
      {/* ---- Segmento ---- */}
      <section>
        <div className="mb-2 flex items-baseline justify-between">
          <h3 className="flex items-center gap-1.5 text-sm font-semibold text-zinc-200">
            <Layers size={14} className="text-[#f5c518]" /> Por segmento
          </h3>
          <span className="text-[11px] text-zinc-500">calibra público das campanhas</span>
        </div>

        {segments.length === 0 ? (
          <div className="rounded-xl border border-zinc-900 bg-zinc-950/60 p-4 text-xs text-zinc-500">Sem leads no período.</div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-zinc-900 bg-zinc-950/60 p-4">
            <table className="w-full min-w-[560px] text-xs">
              <thead>
                <tr className="text-left text-[10px] uppercase tracking-wider text-zinc-500">
                  <th className="pb-2 font-medium">Segmento</th>
                  <th className="pb-2 font-medium">Volume</th>
                  <th className="pb-2 text-right font-medium">Leads</th>
                  <th className="pb-2 text-right font-medium">Qualif.</th>
                  <th className="pb-2 text-right font-medium">Agend.</th>
                  <th className="pb-2 text-right font-medium">Ganhos</th>
                  <th className="pb-2 text-right font-medium">Conv.</th>
                  <th className="pb-2 text-right font-medium">Faturamento</th>
                </tr>
              </thead>
              <tbody>
                {segments.map((s) => (
                  <tr key={s.key} className="border-t border-zinc-900">
                    <td className="py-2 font-medium text-zinc-200">{s.label}</td>
                    <td className="py-2 pr-3" style={{ width: "22%" }}>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-900">
                        <div className="h-full rounded-full bg-[#f5c518]" style={{ width: `${(s.leads / maxSeg) * 100}%` }} />
                      </div>
                    </td>
                    <td className="py-2 text-right font-semibold tabular-nums text-zinc-100">{s.leads}</td>
                    <td className="py-2 text-right tabular-nums text-zinc-300">{s.qualificados}</td>
                    <td className="py-2 text-right tabular-nums text-sky-300">{s.agendamentos}</td>
                    <td className="py-2 text-right tabular-nums text-emerald-300">{s.ganhos}</td>
                    <td className="py-2 text-right font-semibold tabular-nums text-emerald-300">{Math.round(s.convRate)}%</td>
                    <td className="py-2 text-right tabular-nums text-zinc-300">{fmtBRL(s.faturamento)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ---- Perfil dos leads ---- */}
      <section>
        <div className="mb-2 flex items-baseline justify-between">
          <h3 className="flex items-center gap-1.5 text-sm font-semibold text-zinc-200">
            <Users size={14} className="text-[#f5c518]" /> Perfil dos leads
          </h3>
          <span className="text-[11px] text-zinc-500">quem são os leads que entram</span>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {profile.map((dim) => (
            <div key={dim.key} className="rounded-xl border border-zinc-900 bg-zinc-950/60 p-4">
              <div className="mb-2 flex items-baseline justify-between">
                <span className="text-xs font-semibold text-zinc-300">{dim.label}</span>
                <span className="text-[10px] text-zinc-600">{dim.total} preenchidos</span>
              </div>
              {dim.items.length === 0 ? (
                <p className="text-[11px] text-zinc-600">Sem dados.</p>
              ) : (
                <ul className="space-y-1.5">
                  {dim.items.map((it) => (
                    <li key={it.value} className="flex items-center gap-2">
                      <span className="w-32 shrink-0 truncate text-[11px] text-zinc-300" title={it.label}>{it.label}</span>
                      <div className="h-2 flex-1 overflow-hidden rounded-full bg-zinc-900">
                        <div className="h-full rounded-full bg-[#f5c518]/80" style={{ width: `${it.pct}%` }} />
                      </div>
                      <span className="w-16 text-right text-[11px] tabular-nums text-zinc-400">
                        {it.count} · {Math.round(it.pct)}%
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
