"use client";

import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useTasksContext } from "@/lib/contexts/TasksContext";
import { STATUS_COLORS, type Lead } from "@/lib/types";

type Props = {
  cursor: Date;
  leads: Lead[];
  onClickLead: (lead: Lead) => void;
};

const START_HOUR = 7;
const END_HOUR = 21;
const HOUR_HEIGHT = 48; // px

function startOfWeek(d: Date) {
  const x = new Date(d);
  const day = x.getDay();
  const diff = (day === 0 ? -6 : 1) - day;
  x.setDate(x.getDate() + diff);
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

export function WeekView({ cursor, leads, onClickLead }: Props) {
  const { tasks } = useTasksContext();
  const weekStart = startOfWeek(cursor);
  const days = useMemo(() => {
    const arr: Date[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(weekStart);
      d.setDate(weekStart.getDate() + i);
      arr.push(d);
    }
    return arr;
  }, [weekStart]);

  const meetingsByDay = useMemo(() => {
    const map = new Map<string, Lead[]>();
    for (const l of leads) {
      if (!l.data_agendamento) continue;
      const d = new Date(l.data_agendamento);
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      const arr = map.get(key) ?? [];
      arr.push(l);
      map.set(key, arr);
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

  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  const today = now;
  const hours = Array.from({ length: END_HOUR - START_HOUR }, (_, i) => START_HOUR + i);

  function meetingPosition(date: Date) {
    const minutes = (date.getHours() - START_HOUR) * 60 + date.getMinutes();
    return (minutes / 60) * HOUR_HEIGHT;
  }

  // Posição do indicador "agora" se estiver na faixa visível
  const nowInRange = now.getHours() >= START_HOUR && now.getHours() < END_HOUR;
  const nowIsInWeek = days.some((d) => isSameDay(d, now));
  const nowTop = nowInRange ? meetingPosition(now) : null;

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Cabeçalho dos dias */}
      <div className="grid grid-cols-[60px_repeat(7,1fr)] border-b border-zinc-900 bg-zinc-950/50">
        <div />
        {days.map((d) => {
          const isToday = isSameDay(d, today);
          const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
          const taskCount = tasksByDay.get(key) ?? 0;
          return (
            <div
              key={d.toISOString()}
              className={`relative flex flex-col items-center py-2 ${isToday ? "bg-[#f5c518]/10" : ""}`}
            >
              <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                {format(d, "EEE", { locale: ptBR })}
              </span>
              <span className={`text-base font-bold ${isToday ? "text-[#f5c518]" : "text-zinc-300"}`}>
                {d.getDate()}
              </span>
              {taskCount > 0 && (
                <span
                  className="absolute top-1.5 right-1.5 flex h-2 w-2 items-center justify-center rounded-full bg-orange-400"
                  title={`${taskCount} tarefa${taskCount === 1 ? "" : "s"} pendente${taskCount === 1 ? "" : "s"}`}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Grid de horas */}
      <div className="flex-1 overflow-y-auto">
        <div
          className="relative grid grid-cols-[60px_repeat(7,1fr)]"
          style={{ height: hours.length * HOUR_HEIGHT }}
        >
          {/* Linha do "agora" */}
          {nowTop != null && nowIsInWeek && (
            <>
              <div
                className="pointer-events-none absolute z-20 flex items-center"
                style={{ top: nowTop - 8, left: 0, width: 60 }}
              >
                <span className="ml-auto mr-1.5 rounded bg-rose-500 px-1 py-0.5 text-[9px] font-bold leading-none text-white">
                  {format(now, "HH:mm")}
                </span>
              </div>
              <div
                className="pointer-events-none absolute z-10 h-px bg-rose-500"
                style={{ top: nowTop, left: 60, right: 0 }}
              />
              <div
                className="pointer-events-none absolute z-20 h-2.5 w-2.5 -translate-y-1/2 rounded-full bg-rose-500 ring-2 ring-rose-500/30"
                style={{ top: nowTop, left: 60 - 5 }}
              />
            </>
          )}
          {/* Coluna de horas */}
          <div className="border-r border-zinc-900">
            {hours.map((h) => (
              <div
                key={h}
                className="flex items-start justify-end pr-2 text-[10px] text-zinc-600"
                style={{ height: HOUR_HEIGHT }}
              >
                {h}h
              </div>
            ))}
          </div>

          {/* Colunas de dias */}
          {days.map((d) => {
            const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
            const meetings = meetingsByDay.get(key) ?? [];

            return (
              <div key={d.toISOString()} className="relative border-r border-zinc-900">
                {/* Linhas das horas */}
                {hours.map((h) => (
                  <div
                    key={h}
                    className="border-b border-zinc-900/60"
                    style={{ height: HOUR_HEIGHT }}
                  />
                ))}

                {/* Reuniões */}
                {meetings.map((l) => {
                  const date = new Date(l.data_agendamento!);
                  if (date.getHours() < START_HOUR || date.getHours() >= END_HOUR) return null;
                  const top = meetingPosition(date);
                  const c = STATUS_COLORS[l.status];
                  return (
                    <button
                      key={l.id}
                      onClick={() => onClickLead(l)}
                      className={`absolute left-1 right-1 overflow-hidden rounded p-1.5 text-left ${c.bg} ${c.border} border hover:brightness-125`}
                      style={{ top, height: 44 }}
                      title={`${format(date, "HH:mm")} · ${l.empresa || l.nome}`}
                    >
                      <div className={`truncate text-[10px] font-medium ${c.text}`}>
                        {format(date, "HH:mm")}
                      </div>
                      <div className="truncate text-[11px] font-medium text-zinc-200">
                        {l.empresa || l.nome}
                      </div>
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
