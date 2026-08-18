"use client";

import { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { TopBar } from "@/components/layout/TopBar";
import { NewTaskDialog } from "@/components/tasks/NewTaskDialog";
import { TaskItem } from "@/components/tasks/TaskItem";
import { TaskAgenda } from "@/components/tasks/TaskAgenda";
import { useLeadsContext } from "@/lib/contexts/LeadsContext";
import { useTasksContext } from "@/lib/contexts/TasksContext";
import { useTeamContext } from "@/lib/contexts/TeamContext";
import type { Task } from "@/lib/types";

type FilterKey = "abertas" | "hoje" | "atrasadas" | "concluidas" | "todas";

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "abertas",     label: "Abertas" },
  { key: "hoje",        label: "Hoje" },
  { key: "atrasadas",   label: "Atrasadas" },
  { key: "concluidas",  label: "Concluídas" },
  { key: "todas",       label: "Todas" },
];

function startOfDay(d: Date) { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; }
function endOfDay(d: Date)   { const x = new Date(d); x.setHours(23, 59, 59, 999); return x; }

function filterTasks(tasks: Task[], key: FilterKey): Task[] {
  const now = new Date();
  const today0 = startOfDay(now);
  const today23 = endOfDay(now);

  switch (key) {
    case "abertas":
      return tasks.filter((t) => !t.done);
    case "hoje":
      return tasks.filter((t) => !t.done && t.due_at &&
        new Date(t.due_at) >= today0 && new Date(t.due_at) <= today23);
    case "atrasadas":
      return tasks.filter((t) => !t.done && t.due_at && new Date(t.due_at) < today0);
    case "concluidas":
      return tasks.filter((t) => t.done);
    case "todas":
      return tasks;
  }
}

function groupTasks(tasks: Task[]): { label: string; items: Task[] }[] {
  const now = new Date();
  const today0 = startOfDay(now);
  const today23 = endOfDay(now);
  const tomorrow0 = new Date(today0); tomorrow0.setDate(tomorrow0.getDate() + 1);
  const tomorrow23 = endOfDay(tomorrow0);
  const weekEnd = new Date(today0); weekEnd.setDate(weekEnd.getDate() + 7);

  const groups: Record<string, Task[]> = {
    "Atrasadas": [],
    "Hoje": [],
    "Amanhã": [],
    "Esta semana": [],
    "Próximas": [],
    "Sem data": [],
    "Concluídas": [],
  };

  for (const t of tasks) {
    if (t.done) {
      groups["Concluídas"].push(t);
      continue;
    }
    if (!t.due_at) {
      groups["Sem data"].push(t);
      continue;
    }
    const d = new Date(t.due_at);
    if (d < today0) groups["Atrasadas"].push(t);
    else if (d <= today23) groups["Hoje"].push(t);
    else if (d <= tomorrow23) groups["Amanhã"].push(t);
    else if (d <= weekEnd) groups["Esta semana"].push(t);
    else groups["Próximas"].push(t);
  }

  return Object.entries(groups)
    .filter(([, items]) => items.length > 0)
    .map(([label, items]) => ({ label, items }));
}

export default function TarefasPage() {
  const { tasks: allTasks } = useTasksContext();
  const { leads } = useLeadsContext();
  const { members } = useTeamContext();
  const [mode, setMode] = useState<"agenda" | "lista">("agenda");
  const [filter, setFilter] = useState<FilterKey>("abertas");
  const [assignee, setAssignee] = useState<string | null>(null); // null = todos
  const [newOpen, setNewOpen] = useState(false);
  const [editing, setEditing] = useState<Task | null>(null);

  // Filtro por responsável (aplica na agenda e na lista).
  const tasks = useMemo(
    () => (assignee ? allTasks.filter((t) => t.assignee === assignee) : allTasks),
    [allTasks, assignee],
  );

  const filtered = useMemo(() => filterTasks(tasks, filter), [tasks, filter]);
  const groups = useMemo(() => groupTasks(filtered), [filtered]);

  const counts: Record<FilterKey, number> = {
    abertas: tasks.filter((t) => !t.done).length,
    hoje: filterTasks(tasks, "hoje").length,
    atrasadas: filterTasks(tasks, "atrasadas").length,
    concluidas: tasks.filter((t) => t.done).length,
    todas: tasks.length,
  };

  return (
    <>
      <TopBar title="Tarefas" />

      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-900 px-4 py-2.5 sm:px-6">
        <div className="flex flex-wrap items-center gap-2">
          {/* Alternador Agenda | Lista */}
          <div className="flex rounded-md border border-zinc-800 bg-zinc-900 p-0.5 text-xs">
            {(["agenda", "lista"] as const).map((m) => (
              <button key={m} onClick={() => setMode(m)}
                className={`rounded px-3 py-1 capitalize transition-colors ${mode === m ? "bg-[#f5c518] font-semibold text-zinc-950" : "text-zinc-400 hover:text-zinc-200"}`}>
                {m}
              </button>
            ))}
          </div>

          {/* Filtro por responsável */}
          <select
            value={assignee ?? ""}
            onChange={(e) => setAssignee(e.target.value || null)}
            className="rounded-md border border-zinc-800 bg-zinc-900 px-2.5 py-1.5 text-xs text-zinc-300 outline-none [color-scheme:dark] hover:border-zinc-700 focus:border-[#f5c518]"
            title="Filtrar por responsável"
          >
            <option value="">👤 Todos os responsáveis</option>
            {members.map((m) => (
              <option key={m.id} value={m.name}>{m.name}</option>
            ))}
          </select>

          {mode === "lista" && FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs transition-colors ${
                filter === f.key
                  ? "border-[#f5c518]/40 bg-[#f5c518]/10 text-[#f5c518]"
                  : "border-zinc-800 bg-zinc-900 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200"
              }`}
            >
              <span>{f.label}</span>
              <span className="rounded bg-zinc-950/50 px-1 text-[10px]">{counts[f.key]}</span>
            </button>
          ))}
        </div>

        <button
          onClick={() => setNewOpen(true)}
          className="flex items-center gap-1.5 rounded-md bg-[#f5c518] px-3 py-1.5 text-xs font-semibold text-zinc-950 hover:bg-[#ffd633]"
        >
          <Plus size={14} strokeWidth={2.5} />
          Nova tarefa
        </button>
      </div>

      {mode === "agenda" ? (
        <main className="flex flex-1 flex-col overflow-hidden px-2 py-2 sm:px-4">
          <TaskAgenda tasks={tasks} onClickTask={setEditing} />
        </main>
      ) : (
        <main className="flex-1 overflow-y-auto px-4 py-5 sm:px-6">
          <div className="mx-auto max-w-2xl space-y-6">
            {filtered.length === 0 ? (
              <div className="rounded-xl border border-zinc-900 bg-zinc-950/40 px-6 py-12 text-center text-sm text-zinc-500">
                Nenhuma tarefa.
              </div>
            ) : (
              groups.map(({ label, items }) => (
                <section key={label}>
                  <h2 className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">
                    {label}
                    <span className="rounded bg-zinc-900 px-1.5 py-0.5 text-[10px] text-zinc-400">
                      {items.length}
                    </span>
                  </h2>
                  <div className="space-y-1.5">
                    {items.map((t) => (
                      <TaskItem key={t.id} task={t} onEdit={setEditing} />
                    ))}
                  </div>
                </section>
              ))
            )}
          </div>
        </main>
      )}

      <NewTaskDialog
        open={newOpen}
        onClose={() => setNewOpen(false)}
        leadsForPicker={leads}
      />

      <NewTaskDialog
        open={editing != null}
        task={editing}
        onClose={() => setEditing(null)}
        leadsForPicker={leads}
      />
    </>
  );
}
