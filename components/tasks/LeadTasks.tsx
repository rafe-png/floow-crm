"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { NewTaskDialog } from "@/components/tasks/NewTaskDialog";
import { TaskItem } from "@/components/tasks/TaskItem";
import { useTasksContext } from "@/lib/contexts/TasksContext";
import type { Lead } from "@/lib/types";

/**
 * Seção compacta de tarefas dentro de um lead — usada no painel lateral e no modal.
 */
export function LeadTasks({ lead }: { lead: Lead }) {
  const { tasks } = useTasksContext();
  const [open, setOpen] = useState(false);

  const leadTasks = tasks
    .filter((t) => t.lead_id === lead.id)
    .sort((a, b) => {
      if (a.done !== b.done) return a.done ? 1 : -1;
      if (a.due_at && b.due_at) return a.due_at.localeCompare(b.due_at);
      if (a.due_at) return -1;
      if (b.due_at) return 1;
      return 0;
    });

  const pendingCount = leadTasks.filter((t) => !t.done).length;

  return (
    <section>
      <div className="mb-2 flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">
          Tarefas
          {pendingCount > 0 && (
            <span className="rounded bg-[#f5c518]/10 px-1.5 py-0.5 text-[10px] text-[#f5c518]">
              {pendingCount} aberta{pendingCount === 1 ? "" : "s"}
            </span>
          )}
        </h3>
        <button
          onClick={() => setOpen(true)}
          className="flex items-center gap-1 rounded-md border border-zinc-800 bg-zinc-900 px-2 py-1 text-[10px] text-zinc-300 hover:border-zinc-700 hover:text-zinc-100"
        >
          <Plus size={10} />
          Adicionar
        </button>
      </div>

      {leadTasks.length === 0 ? (
        <div className="rounded-md border border-zinc-800/70 bg-zinc-900/40 px-3 py-2 text-xs text-zinc-500">
          Nenhuma tarefa. Clique em <strong>Adicionar</strong> pra criar a primeira.
        </div>
      ) : (
        <div className="space-y-1.5">
          {leadTasks.map((t) => (
            <TaskItem key={t.id} task={t} showLead={false} />
          ))}
        </div>
      )}

      <NewTaskDialog open={open} onClose={() => setOpen(false)} lead={lead} />
    </section>
  );
}
