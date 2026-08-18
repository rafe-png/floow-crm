"use client";

import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { TASK_TIPO_ICONS, TASK_TIPO_LABELS, type Task } from "@/lib/types";

// Cor por STATUS de prazo (não pelo tipo):
//   feita = verde · atrasada = vermelho · hoje = amarelo · em dia (futuro) = azul.
const C_DONE = "#34d399", C_LATE = "#ef4444", C_TODAY = "#f5c518", C_FUTURE = "#3b82f6";
function taskColor(t: Task): string {
  if (t.done) return C_DONE;
  if (!t.due_at) return C_FUTURE;
  const d = startOfDay(new Date(t.due_at));
  const today = startOfDay(new Date());
  if (d.getTime() < today.getTime()) return C_LATE;
  if (d.getTime() === today.getTime()) return C_TODAY;
  return C_FUTURE;
}

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

      <Legend />
      {view === "mes" && <MonthGrid cursor={cursor} tasks={dated} onClickTask={onClickTask} />}
      {view === "semana" && <DayColumns days={weekDays(cursor)} tasks={dated} onClickTask={onClickTask} />}
      {view === "dia" && <DayColumns days={[startOfDay(cursor)]} tasks={dated} onClickTask={onClickTask} />}
    </div>
  );
}

// Legenda das cores por status de prazo.
function Legend() {
  const items = [
    { c: C_FUTURE, label: "Em dia" },
    { c: C_TODAY, label: "Hoje" },
    { c: C_LATE, label: "Atrasada" },
    { c: C_DONE, label: "Feita" },
  ];
  return (
    <div className="flex flex-wrap items-center gap-3 px-2 py-1.5 text-[10px] text-zinc-500">
      {items.map((i) => (
        <span key={i.label} className="flex items-center gap-1">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ background: i.c }} /> {i.label}
        </span>
      ))}
    </div>
  );
}

function weekDays(cursor: Date): Date[] {
  const start = startOfWeek(cursor);
  return Array.from({ length: 7 }, (_, i) => { const d = new Date(start); d.setDate(start.getDate() + i); return d; });
}

function TaskChip({ t, onClick }: { t: Task; onClick: () => void }) {
  const c = taskColor(t);
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

// ---- Semana / Dia: COLUNA-LISTA por dia (sem sobreposição) ----
// Cada dia é uma coluna com as tarefas em lista (ordenadas por hora). Legível
// mesmo com várias no mesmo horário. Marcador "agora" separa passado/futuro no dia.
function DayColumns({ days, tasks, onClickTask }: { days: Date[]; tasks: Task[]; onClickTask: (t: Task) => void }) {
  const today = new Date();
  const [now, setNow] = useState(() => new Date());
  useEffect(() => { const id = setInterval(() => setNow(new Date()), 60_000); return () => clearInterval(id); }, []);

  const single = days.length === 1;

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Cabeçalho dos dias */}
      <div className="grid border-b border-zinc-900 bg-zinc-950/50" style={{ gridTemplateColumns: `repeat(${days.length}, 1fr)` }}>
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

      <div className="grid flex-1 overflow-y-auto" style={{ gridTemplateColumns: `repeat(${days.length}, 1fr)` }}>
        {days.map((d) => {
          const dayTasks = tasks
            .filter((t) => isSameDay(new Date(t.due_at!), d))
            .sort((a, b) => (a.due_at || "").localeCompare(b.due_at || ""));
          const isToday = isSameDay(d, today);
          // Posição do marcador "agora": índice da 1ª tarefa com hora > agora.
          let nowIdx = -1;
          if (isToday) { nowIdx = dayTasks.findIndex((t) => new Date(t.due_at!).getTime() > now.getTime()); if (nowIdx === -1) nowIdx = dayTasks.length; }
          return (
            <div key={d.toISOString()} className={`min-h-full space-y-1 border-r border-zinc-900 p-1.5 ${isToday ? "bg-[#f5c518]/[0.03]" : ""}`}>
              {dayTasks.length === 0 && <div className="pt-4 text-center text-[10px] text-zinc-700">—</div>}
              {dayTasks.map((t, i) => (
                <div key={t.id}>
                  {isToday && i === nowIdx && <NowMarker now={now} />}
                  <TaskRow t={t} single={single} onClick={() => onClickTask(t)} />
                </div>
              ))}
              {isToday && nowIdx === dayTasks.length && dayTasks.length > 0 && <NowMarker now={now} />}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function NowMarker({ now }: { now: Date }) {
  return (
    <div className="my-1 flex items-center gap-1.5">
      <span className="rounded bg-rose-500 px-1 py-0.5 text-[9px] font-bold leading-none text-white">{format(now, "HH:mm")}</span>
      <div className="h-px flex-1 bg-rose-500" />
    </div>
  );
}

// Uma tarefa na coluna-lista: hora + ícone do tipo + título, cor por status.
function TaskRow({ t, single, onClick }: { t: Task; single: boolean; onClick: () => void }) {
  const c = taskColor(t);
  const dt = new Date(t.due_at!);
  const overdue = !t.done && c === C_LATE;
  return (
    <button
      onClick={onClick}
      title={`${format(dt, "HH:mm")} · ${TASK_TIPO_LABELS[t.tipo]} · ${t.titulo}`}
      className={`flex w-full items-start gap-1.5 overflow-hidden rounded border px-1.5 py-1 text-left ${t.done ? "opacity-60" : ""}`}
      style={{ background: `${c}1f`, borderColor: `${c}66` }}
    >
      <span className="shrink-0 text-[10px] font-bold tabular-nums" style={{ color: c }}>{format(dt, "HH:mm")}</span>
      <span className="min-w-0 flex-1">
        <span className={`block ${single ? "text-xs" : "text-[11px]"} text-zinc-100 ${t.done ? "line-through" : ""} ${single ? "" : "truncate"}`}>
          {TASK_TIPO_ICONS[t.tipo]} {t.titulo}{overdue ? " ⚠️" : ""}
        </span>
      </span>
    </button>
  );
}
