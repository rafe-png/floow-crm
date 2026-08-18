"use client";

import { format, isPast, isToday } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Calendar, ExternalLink, Pencil, Trash2, User } from "lucide-react";
import Link from "next/link";
import { useTasksContext } from "@/lib/contexts/TasksContext";
import { useLeadsContext } from "@/lib/contexts/LeadsContext";
import { WhatsAppIcon } from "@/components/icons/BrandIcons";
import { TASK_TIPO_ICONS, TASK_TIPO_LABELS, TASK_TIPO_COLORS, WHATSAPP_TAB, whatsappLink, type Task } from "@/lib/types";

type Props = {
  task: Task;
  showLead?: boolean;
  onEdit?: (task: Task) => void;
};

export function TaskItem({ task, showLead = true, onEdit }: Props) {
  const { toggleDone, deleteTask } = useTasksContext();
  const { leads } = useLeadsContext();

  const lead = task.lead_id ? leads.find((l) => l.id === task.lead_id) : null;
  const due = task.due_at ? new Date(task.due_at) : null;
  const overdue = due && !task.done && isPast(due) && !isToday(due);
  const dueToday = due && isToday(due);

  return (
    <div
      className={`group flex items-start gap-2.5 rounded-lg border bg-zinc-950/40 p-3 transition-colors ${
        task.done ? "border-zinc-900 opacity-60" : overdue ? "border-rose-500/30 bg-rose-500/5" : "border-zinc-800"
      }`}
    >
      <button
        onClick={() => toggleDone(task.id, !task.done)}
        className={`mt-0.5 h-4 w-4 shrink-0 rounded border transition-colors ${
          task.done
            ? "border-emerald-500 bg-emerald-500"
            : "border-zinc-700 hover:border-zinc-500"
        }`}
        aria-label={task.done ? "Reabrir" : "Concluir"}
      >
        {task.done && (
          <svg viewBox="0 0 16 16" className="text-zinc-950">
            <path d="M3 8l3 3 7-7" stroke="currentColor" strokeWidth="2" fill="none" />
          </svg>
        )}
      </button>

      <div className="min-w-0 flex-1">
        {task.tipo && task.tipo !== "outro" && (
          <span
            className="mb-1 mr-1.5 inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-semibold"
            style={{ color: TASK_TIPO_COLORS[task.tipo], background: `${TASK_TIPO_COLORS[task.tipo]}1f` }}
          >
            {TASK_TIPO_ICONS[task.tipo]} {TASK_TIPO_LABELS[task.tipo]}
          </span>
        )}
        <div className={`text-sm ${task.done ? "text-zinc-500 line-through" : "text-zinc-100"}`}>
          {task.titulo}
        </div>
        {task.descricao && (
          <div className={`mt-0.5 text-xs ${task.done ? "text-zinc-600" : "text-zinc-500"} line-clamp-2`}>
            {task.descricao}
          </div>
        )}

        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-zinc-500">
          {due && (
            <span className={`flex items-center gap-1 ${overdue ? "text-rose-400" : dueToday ? "text-[#f5c518]" : ""}`}>
              <Calendar size={10} />
              {format(due, "d MMM · HH:mm", { locale: ptBR })}
              {overdue && " · atrasada"}
            </span>
          )}
          {task.assignee && (
            <span className="flex items-center gap-1">
              <User size={10} />
              {task.assignee}
            </span>
          )}
          {showLead && lead && (
            <Link
              href={`/kanban?lead=${lead.id}`}
              className="flex items-center gap-1 rounded bg-zinc-900 px-1.5 py-0.5 text-zinc-400 hover:text-zinc-200"
            >
              <ExternalLink size={9} />
              {lead.empresa || lead.nome}
            </Link>
          )}
          {lead && lead.telefone && !lead.telefone.includes("@lid") && (
            <a
              href={whatsappLink(lead.telefone)}
              target={WHATSAPP_TAB}
              className="flex items-center gap-1 rounded bg-[#25D366]/10 px-1.5 py-0.5 font-medium text-[#25D366] hover:bg-[#25D366]/20"
              title="Abrir conversa no WhatsApp"
            >
              <WhatsAppIcon size={10} />
              WhatsApp
            </a>
          )}
        </div>
      </div>

      <div className="flex items-center gap-1.5">
        {onEdit && (
          <button
            onClick={() => onEdit(task)}
            className="text-zinc-500 hover:text-zinc-200"
            aria-label="Editar"
          >
            <Pencil size={14} />
          </button>
        )}
        <button
          onClick={() => {
            if (confirm(`Excluir tarefa "${task.titulo}"?`)) {
              deleteTask(task.id);
            }
          }}
          className="text-zinc-500 hover:text-rose-400"
          aria-label="Excluir"
        >
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  );
}
