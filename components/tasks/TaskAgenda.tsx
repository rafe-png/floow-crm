"use client";

import { useMemo, useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { TASK_TIPO_COLORS, TASK_TIPO_ICONS, TASK_TIPO_LABELS, type Task } from "@/lib/types";

type ViewMode = "dia" | "semana" | "mes";

function startOfDay(d: Date) { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; }
function startOfWeek(d: Date) {
  const x = startOfDay(d); const day = x.getDay();
  x.setDate(x.getDate() + ((day === 0 ? -6 : 1) - day)); return x;
}
function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}
const WD = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

export function TaskAgenda({ tasks, onClickTask }: { tasks: Task[]; onClickTask: (t: Task) => void }) {
  const [view, setView] = useState<ViewMode>("semana");
  const [cursor, setCursor] = useState(new Date());

  // Só tarefas com prazo entram na agenda.
  const dated = useMemo(() => tasks.filter((t) => t.due_at), [tasks]);

  function step(dir: 1 | -1) {
    const d = new Date(cursor);
    if (view === "mes") d.setMonth(d.getMonth() + dir);
    else if (view === "semana") d.setDate(d.getDate() + 7 * dir);
    else d.setDate(d.getDate() + dir);
    setCursor(d);
  }

  const title =
    view === "mes" ? format(cursor, "MMMM 'de' yyyy", { locale: ptBR })
    : view === "semana" ? `Semana de ${format(startOfWeek(cursor), "d MMM", { locale: ptBR })}`
    : format(cursor, "EEEE, d 'de' MMMM", { locale: ptBR });

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Cabeçalho de navegação */}
      <div className="flex items-center justify-between gap-3 border-b border-zinc-900 px-1 py-2">
        <div className="flex items-center gap-1.5">
          <button onClick={() => step(-1)} className="rounded p-1.5 text-zinc-400 hover:bg-zinc-900 hover:text-zinc-100" aria-label="Anterior"><ChevronLeft size={16} /></button>
          <button onClick={() => setCursor(new Date())} className="rounded-md border border-zinc-800 bg-zinc-900 px-3 py-1 text-xs text-zinc-300 hover:border-zinc-700 hover:text-zinc-100">Hoje</button>
          <button onClick={() => step(1)} className="rounded p-1.5 text-zinc-400 hover:bg-zinc-900 hover:text-zinc-100" aria-label="Próximo"><ChevronRight size={16} /></button>
          <h2 className="ml-2 text-sm font-semibold capitalize text-zinc-200">{title}</h2>
        </div>
        <div className="flex rounded-md border border-zinc-800 bg-zinc-900 p-0.5 text-xs">
          {(["dia", "semana", "mes"] as ViewMode[]).map((v) => (
            <button key={v} onClick={() => setView(v)}
              className={`rounded px-3 py-1 capitalize transition-colors ${view === v ? "bg-[#f5c518] font-semibold text-zinc-950" : "text-zinc-400 hover:text-zinc-200"}`}>
              {v === "dia" ? "Dia" : v === "semana" ? "Semana" : "Mês"}
            </button>
          ))}
        </div>
      </div>

      {view === "mes" && <MonthGrid cursor={cursor} tasks={dated} onClickTask={onClickTask} />}
      {view === "semana" && <Timeline days={weekDays(cursor)} tasks={dated} onClickTask={onClickTask} />}
      {view === "dia" && <Timeline days={[startOfDay(cursor)]} tasks={dated} onClickTask={onClickTask} />}
    </div>
  );
}

function weekDays(cursor: Date): Date[] {
  const start = startOfWeek(cursor);
  return Array.from({ length: 7 }, (_, i) => { const d = new Date(start); d.setDate(start.getDate() + i); return d; });
}

function TaskChip({ t, onClick }: { t: Task; onClick: () => void }) {
  const c = TASK_TIPO_COLORS[t.tipo] || "#71717a";
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      title={`${TASK_TIPO_LABELS[t.tipo]} · ${t.titulo}`}
      className={`flex w-full items-center gap-1 overflow-hidden rounded px-1.5 py-0.5 text-left text-[10px] ${t.done ? "opacity-50 line-through" : ""}`}
      style={{ background: `${c}22`, color: c }}
    >
      <span>{TASK_TIPO_ICONS[t.tipo] || "📌"}</span>
      <span className="truncate">{t.titulo}</span>
    </button>
  );
}

// ---- Mês (grade 7x6) ----
function MonthGrid({ cursor, tasks, onClickTask }: { cursor: Date; tasks: Task[]; onClickTask: (t: Task) => void }) {
  const first = new Date(cursor); first.setDate(1); first.setHours(0, 0, 0, 0);
  const gridStart = new Date(first);
  const dow = first.getDay();
  gridStart.setDate(first.getDate() + (dow === 0 ? -6 : 1 - dow));
  const days = Array.from({ length: 42 }, (_, i) => { const d = new Date(gridStart); d.setDate(gridStart.getDate() + i); return d; });

  const byDay = useMemo(() => {
    const m = new Map<string, Task[]>();
    for (const t of tasks) {
      const d = new Date(t.due_at!);
      const k = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      (m.get(k) ?? m.set(k, []).get(k)!).push(t);
    }
    for (const arr of m.values()) arr.sort((a, b) => (a.due_at || "").localeCompare(b.due_at || ""));
    return m;
  }, [tasks]);

  const today = new Date();
  return (
    <div className="flex-1 overflow-y-auto">
      <div className="grid grid-cols-7 border-b border-zinc-900 text-center text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
        {WD.map((w) => <div key={w} className="py-1.5">{w}</div>)}
      </div>
      <div className="grid grid-cols-7">
        {days.map((d) => {
          const inMonth = d.getMonth() === cursor.getMonth();
          const k = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
          const items = byDay.get(k) ?? [];
          const isToday = isSameDay(d, today);
          return (
            <div key={d.toISOString()} className={`min-h-[92px] border-b border-r border-zinc-900 p-1 ${inMonth ? "" : "bg-zinc-950/40"}`}>
              <div className={`mb-1 text-right text-[11px] ${isToday ? "font-bold text-[#f5c518]" : inMonth ? "text-zinc-400" : "text-zinc-700"}`}>{d.getDate()}</div>
              <div className="space-y-0.5">
                {items.slice(0, 3).map((t) => <TaskChip key={t.id} t={t} onClick={() => onClickTask(t)} />)}
                {items.length > 3 && <div className="px-1 text-[9px] text-zinc-500">+{items.length - 3} mais</div>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---- Semana / Dia (linha do tempo 7h–21h) ----
const START_HOUR = 7;
const END_HOUR = 21;
const HOUR_HEIGHT = 46;

function Timeline({ days, tasks, onClickTask }: { days: Date[]; tasks: Task[]; onClickTask: (t: Task) => void }) {
  const hours = Array.from({ length: END_HOUR - START_HOUR }, (_, i) => START_HOUR + i);
  const today = new Date();

  function posTop(d: Date) {
    const min = Math.max(0, Math.min((END_HOUR - START_HOUR) * 60, (d.getHours() - START_HOUR) * 60 + d.getMinutes()));
    return (min / 60) * HOUR_HEIGHT;
  }

  return (
    <div className="flex-1 overflow-hidden">
      {/* Cabeçalho dos dias */}
      <div className="grid border-b border-zinc-900 bg-zinc-950/50" style={{ gridTemplateColumns: `48px repeat(${days.length}, 1fr)` }}>
        <div />
        {days.map((d) => {
          const isToday = isSameDay(d, today);
          return (
            <div key={d.toISOString()} className={`flex flex-col items-center py-1.5 ${isToday ? "bg-[#f5c518]/10" : ""}`}>
              <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">{format(d, "EEE", { locale: ptBR })}</span>
              <span className={`text-sm font-bold ${isToday ? "text-[#f5c518]" : "text-zinc-300"}`}>{d.getDate()}</span>
            </div>
          );
        })}
      </div>

      <div className="overflow-y-auto" style={{ maxHeight: "calc(100vh - 220px)" }}>
        <div className="relative grid" style={{ gridTemplateColumns: `48px repeat(${days.length}, 1fr)`, height: hours.length * HOUR_HEIGHT }}>
          {/* coluna de horas */}
          <div className="border-r border-zinc-900">
            {hours.map((hr) => <div key={hr} className="flex items-start justify-end pr-2 text-[10px] text-zinc-600" style={{ height: HOUR_HEIGHT }}>{hr}h</div>)}
          </div>
          {/* colunas de dias */}
          {days.map((d) => {
            const dayTasks = tasks
              .filter((t) => isSameDay(new Date(t.due_at!), d))
              .sort((a, b) => (a.due_at || "").localeCompare(b.due_at || ""));
            return (
              <div key={d.toISOString()} className="relative border-r border-zinc-900">
                {hours.map((hr) => <div key={hr} className="border-b border-zinc-900/60" style={{ height: HOUR_HEIGHT }} />)}
                {dayTasks.map((t, i) => {
                  const dt = new Date(t.due_at!);
                  const c = TASK_TIPO_COLORS[t.tipo] || "#71717a";
                  const overdue = !t.done && dt.getTime() < Date.now();
                  return (
                    <button
                      key={t.id}
                      onClick={() => onClickTask(t)}
                      title={`${format(dt, "HH:mm")} · ${TASK_TIPO_LABELS[t.tipo]} · ${t.titulo}`}
                      className={`absolute left-1 right-1 overflow-hidden rounded border px-1.5 py-1 text-left ${t.done ? "opacity-50" : ""}`}
                      style={{ top: posTop(dt) + i * 2, minHeight: 34, background: `${c}1f`, borderColor: `${c}66`, zIndex: 1 }}
                    >
                      <div className="text-[10px] font-semibold" style={{ color: c }}>{format(dt, "HH:mm")} {TASK_TIPO_ICONS[t.tipo]}{overdue ? " ⚠️" : ""}</div>
                      <div className={`truncate text-[11px] text-zinc-200 ${t.done ? "line-through" : ""}`}>{t.titulo}</div>
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
