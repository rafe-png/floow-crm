"use client";

import Link from "next/link";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Calendar, Clock } from "lucide-react";
import type { Lead } from "@/lib/types";

type Props = { leads: Lead[] };

export function UpcomingMeetings({ leads }: Props) {
  const now = new Date();
  const in7 = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  const upcoming = leads
    .filter((l) => l.status === "reuniao_agendada" && l.data_agendamento)
    .filter((l) => {
      const d = new Date(l.data_agendamento!);
      return d >= now && d <= in7;
    })
    .sort((a, b) => new Date(a.data_agendamento!).getTime() - new Date(b.data_agendamento!).getTime())
    .slice(0, 8);

  return (
    <div className="rounded-xl border border-zinc-900 bg-zinc-950/60 p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-zinc-200">Próximas reuniões</h3>
        <Link href="/agenda" className="text-xs text-zinc-500 hover:text-zinc-300">
          ver agenda →
        </Link>
      </div>

      {upcoming.length === 0 ? (
        <div className="py-8 text-center text-xs text-zinc-600">
          <Calendar size={24} className="mx-auto mb-2 opacity-40" />
          Nenhuma reunião agendada nos próximos 7 dias.
        </div>
      ) : (
        <ul className="space-y-2">
          {upcoming.map((l) => (
            <li
              key={l.id}
              className="rounded-md border border-zinc-800/70 bg-zinc-900/40 p-2.5"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium text-zinc-100">
                    {l.empresa || l.nome}
                  </div>
                  {l.empresa && (
                    <div className="truncate text-xs text-zinc-500">{l.nome}</div>
                  )}
                </div>
                <div className="shrink-0 text-right">
                  <div className="text-xs font-medium text-[#f5c518]">
                    {format(new Date(l.data_agendamento!), "d MMM", { locale: ptBR })}
                  </div>
                  <div className="flex items-center justify-end gap-1 text-[10px] text-zinc-500">
                    <Clock size={9} />
                    {format(new Date(l.data_agendamento!), "HH:mm")}
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
