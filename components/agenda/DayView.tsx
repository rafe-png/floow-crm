"use client";

import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { useTasksContext } from "@/lib/contexts/TasksContext";
import { STATUS_COLORS, type Lead } from "@/lib/types";

type Props = {
  cursor: Date;
  leads: Lead[];
  onClickLead: (lead: Lead) => void;
};

const START_HOUR = 7;
const END_HOUR = 21;
const HOUR_HEIGHT = 56; // px

function isSameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function DayView({ cursor, leads, onClickLead }: Props) {
  const { tasks } = useTasksContext();

  const meetings = useMemo(
    () =>
      leads
        .filter((l) => l.data_agendamento && isSameDay(new Date(l.data_agendamento), cursor))
        .sort(
          (a, b) =>
            new Date(a.data_agendamento!).getTime() - new Date(b.data_agendamento!).getTime(),
        ),
    [leads, cursor],
  );

  const dayTasks = useMemo(
    () => tasks.filter((t) => !t.done && t.due_at && isSameDay(new Date(t.due_at), cursor)),
    [tasks, cursor],
  );

  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  const hours = Array.from({ length: END_HOUR - START_HOUR }, (_, i) => START_HOUR + i);

  function position(date: Date) {
    const minutes = (date.getHours() - START_HOUR) * 60 + date.getMinutes();
    return (minutes / 60) * HOUR_HEIGHT;
  }

  const nowInRange = now.getHours() >= START_HOUR && now.getHours() < END_HOUR;
  const nowIsToday = isSameDay(now, cursor);
  const nowTop = nowInRange ? position(now) : null;

  const visibleMeetings = meetings.filter((l) => {
    const h = new Date(l.data_agendamento!).getHours();
    return h >= START_HOUR && h < END_HOUR;
  });

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Resumo de tarefas pendentes do dia */}
      {dayTasks.length > 0 && (
        <div className="border-b border-zinc-900 bg-zinc-950/50 px-4 py-2 sm:px-6">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-orange-400">
            {dayTasks.length} tarefa{dayTasks.length === 1 ? "" : "s"} pendente
            {dayTasks.length === 1 ? "" : "s"} neste dia
          </span>
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        <div
          className="relative grid grid-cols-[60px_1fr]"
          style={{ height: hours.length * HOUR_HEIGHT }}
        >
          {/* Linha do "agora" */}
          {nowTop != null && nowIsToday && (
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

          {/* Coluna do dia */}
          <div className="relative">
            {hours.map((h) => (
              <div
                key={h}
                className="border-b border-zinc-900/60"
                style={{ height: HOUR_HEIGHT }}
              />
            ))}

            {visibleMeetings.map((l) => {
              const date = new Date(l.data_agendamento!);
              const top = position(date);
              const c = STATUS_COLORS[l.status];
              return (
                <button
                  key={l.id}
                  onClick={() => onClickLead(l)}
                  className={`absolute left-2 right-2 overflow-hidden rounded-md p-2 text-left ${c.bg} ${c.border} border hover:brightness-125`}
                  style={{ top, height: 52 }}
                  title={`${format(date, "HH:mm")} · ${l.empresa || l.nome}`}
                >
                  <div className={`text-[11px] font-semibold ${c.text}`}>
                    {format(date, "HH:mm")}
                  </div>
                  <div className="truncate text-xs font-medium text-zinc-200">
                    {l.empresa || l.nome}
                  </div>
                </button>
              );
            })}

            {visibleMeetings.length === 0 && (
              <div className="pointer-events-none absolute inset-x-0 top-8 text-center text-xs text-zinc-600">
                Nenhuma reunião neste dia.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
