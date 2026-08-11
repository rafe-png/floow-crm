"use client";

import { useMemo } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useTasksContext } from "@/lib/contexts/TasksContext";
import { STATUS_COLORS, type Lead } from "@/lib/types";

type Props = {
  cursor: Date; // qualquer dia do mês alvo
  leads: Lead[];
  onClickLead: (lead: Lead) => void;
};

function startOfMonth(d: Date) {
  const x = new Date(d);
  x.setDate(1);
  x.setHours(0, 0, 0, 0);
  return x;
}

function isSameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function MonthView({ cursor, leads, onClickLead }: Props) {
  const { tasks } = useTasksContext();
  const first = startOfMonth(cursor);
  // grid começa na segunda da semana que contém o dia 1
  const gridStart = new Date(first);
  const dow = first.getDay();
  const offset = dow === 0 ? -6 : 1 - dow;
  gridStart.setDate(first.getDate() + offset);

  const days: Date[] = [];
  const cursor2 = new Date(gridStart);
  for (let i = 0; i < 42; i++) {
    days.push(new Date(cursor2));
    cursor2.setDate(cursor2.getDate() + 1);
  }

  const meetingsByDay = useMemo(() => {
    const map = new Map<string, Lead[]>();
    const seen = new Set<string>(); // de-duplica o mesmo lead (evita card em dobro)
    for (const l of leads) {
      if (!l.data_agendamento) continue;
      if (seen.has(l.id)) continue;
      seen.add(l.id);
      const d = new Date(l.data_agendamento);
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      const arr = map.get(key) ?? [];
      arr.push(l);
      map.set(key, arr);
    }
    for (const arr of map.values()) {
      arr.sort((a, b) => new Date(a.data_agendamento!).getTime() - new Date(b.data_agendamento!).getTime());
    }
    return map;
  }, [leads]);

  const tasksByDay = useMemo(() => {
    const map = new Map<string, number>();
    for (const t of tasks) {
      if (t.done || !t.due_at) continue;
      const d = new Date(t.due_at);
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      map.set(key, (map.get(key) ?? 0) + 1);
    }
    return map;
  }, [tasks]);

  const today = new Date();
  const targetMonth = first.getMonth();

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Cabeçalho dos dias da semana */}
      <div className="grid grid-cols-7 border-b border-zinc-900 bg-zinc-950/50">
        {["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"].map((d) => (
          <div key={d} className="px-2 py-2 text-center text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
            {d}
          </div>
        ))}
      </div>

      {/* Grid de dias */}
      <div className="grid flex-1 grid-cols-7 grid-rows-6 gap-px bg-zinc-900">
        {days.map((day) => {
          const key = `${day.getFullYear()}-${day.getMonth()}-${day.getDate()}`;
          const meetings = meetingsByDay.get(key) ?? [];
          const taskCount = tasksByDay.get(key) ?? 0;
          const outOfMonth = day.getMonth() !== targetMonth;
          const isToday = isSameDay(day, today);
          const visibleMeetings = meetings.slice(0, 3);
          const extra = meetings.length - visibleMeetings.length;

          return (
            <div
              key={key}
              className={`flex min-h-[80px] flex-col gap-1 p-1.5 ${
                outOfMonth ? "bg-zinc-950/30" : "bg-[#0a0a0a]"
              }`}
            >
              <div className="flex items-center justify-between">
                <span
                  className={`flex h-5 w-5 items-center justify-center rounded text-[10px] font-medium ${
                    isToday
                      ? "bg-[#f5c518] text-zinc-950 font-bold"
                      : outOfMonth
                      ? "text-zinc-700"
                      : "text-zinc-400"
                  }`}
                >
                  {day.getDate()}
                </span>
                {taskCount > 0 && !outOfMonth && (
                  <span
                    className="flex h-2 w-2 items-center justify-center rounded-full bg-orange-400"
                    title={`${taskCount} tarefa${taskCount === 1 ? "" : "s"} pendente${taskCount === 1 ? "" : "s"}`}
                  />
                )}
              </div>

              <div className="flex flex-col gap-0.5">
                {visibleMeetings.map((l) => {
                  const c = STATUS_COLORS[l.status];
                  const isPast = new Date(l.data_agendamento!).getTime() < today.getTime();
                  return (
                    <button
                      key={l.id}
                      onClick={() => onClickLead(l)}
                      className={`group flex items-center gap-1 truncate rounded px-1 py-0.5 text-left text-[10px] ${c.bg} ${isPast ? "brightness-[0.55] hover:brightness-90" : "hover:brightness-125"}`}
                      title={`${format(new Date(l.data_agendamento!), "HH:mm")} · ${l.empresa || l.nome}`}
                    >
                      <span className={`h-1 w-1 shrink-0 rounded-full ${c.dot}`} />
                      <span className={`shrink-0 text-[9px] ${c.text}`}>
                        {format(new Date(l.data_agendamento!), "HH:mm", { locale: ptBR })}
                      </span>
                      <span className="truncate text-zinc-200">{l.empresa || l.nome}</span>
                    </button>
                  );
                })}
                {extra > 0 && (
                  <button
                    onClick={() => onClickLead(meetings[3])}
                    className="rounded px-1 py-0.5 text-left text-[9px] text-zinc-500 hover:text-zinc-300"
                  >
                    +{extra} mais
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
