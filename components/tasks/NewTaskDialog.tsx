"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { DateTimePicker, joinIso, splitIso } from "@/components/ui/DateTimePicker";
import { useAuth } from "@/lib/hooks/useAuth";
import { useTasksContext } from "@/lib/contexts/TasksContext";
import { useTeamContext } from "@/lib/contexts/TeamContext";
import { WhatsAppIcon } from "@/components/icons/BrandIcons";
import {
  WHATSAPP_TAB,
  whatsappLink,
  TASK_TIPO_OPTIONS,
  TASK_TIPO_LABELS,
  TASK_TIPO_ICONS,
  TASK_TIPO_COLORS,
  suggestedTaskDue,
  taskTitleFor,
  type Lead,
  type Task,
  type TaskTipo,
} from "@/lib/types";

type Props = {
  open: boolean;
  onClose: () => void;
  /** Se passado, a tarefa já vem vinculada a esse lead */
  lead?: Lead | null;
  /** Lista de leads pra picker quando não veio fixo (tarefa standalone) */
  leadsForPicker?: Lead[];
  /** Se passado, abre em modo edição dessa tarefa */
  task?: Task | null;
  /** Tipo pré-selecionado (ex: ao mover o lead no funil) */
  initialTipo?: TaskTipo | null;
};

export function NewTaskDialog({ open, onClose, lead, leadsForPicker, task, initialTipo }: Props) {
  if (!open) return null;
  return (
    <Body
      onClose={onClose}
      lead={lead ?? null}
      leadsForPicker={leadsForPicker ?? []}
      task={task ?? null}
      initialTipo={initialTipo ?? null}
    />
  );
}

function Body({
  onClose,
  lead,
  leadsForPicker,
  task,
  initialTipo,
}: {
  onClose: () => void;
  lead: Lead | null;
  leadsForPicker: Lead[];
  task: Task | null;
  initialTipo: TaskTipo | null;
}) {
  const { createTask, updateTask } = useTasksContext();
  const { members, currentMember } = useTeamContext();
  const { user } = useAuth();

  const editing = task != null;
  const startTipo: TaskTipo = task?.tipo ?? initialTipo ?? "outro";
  const startDue = task?.due_at ?? (initialTipo ? suggestedTaskDue(initialTipo, lead) : null);
  const initialDue = splitIso(startDue);

  const [tipo, setTipo] = useState<TaskTipo>(startTipo);
  const [titulo, setTitulo] = useState(task?.titulo ?? (initialTipo ? taskTitleFor(initialTipo, lead) : ""));
  const [descricao, setDescricao] = useState(task?.descricao ?? "");
  const [dateStr, setDateStr] = useState(initialDue.date);
  const [timeStr, setTimeStr] = useState(initialDue.time);

  // Trocar o tipo: auto-preenche título (se ainda no padrão) e prazo sugerido (se vazio).
  function pickTipo(t: TaskTipo) {
    if (!titulo.trim() || titulo === taskTitleFor(tipo, lead)) setTitulo(taskTitleFor(t, lead));
    const sug = suggestedTaskDue(t, lead);
    if (sug && !dateStr && !timeStr) { const s = splitIso(sug); setDateStr(s.date); setTimeStr(s.time); }
    setTipo(t);
  }
  const [assignee, setAssignee] = useState<string | null>(
    task ? task.assignee : currentMember?.name ?? null,
  );
  const [leadId, setLeadId] = useState<string | null>(task ? task.lead_id : lead?.id ?? null);
  const linkedLead = lead ?? leadsForPicker.find((l) => l.id === leadId) ?? null;
  const [notify, setNotify] = useState(task ? task.notify : true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!titulo.trim()) {
      setError("Título é obrigatório.");
      return;
    }
    const dueIso = joinIso(dateStr, timeStr);
    if (!dueIso) {
      setError("Defina o prazo da tarefa (data e hora).");
      return;
    }
    const finalLead = leadId ?? lead?.id ?? null;
    if (!finalLead) {
      setError("Vincule a tarefa a um lead.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      if (editing && task) {
        await updateTask(task.id, {
          lead_id: finalLead,
          titulo: titulo.trim(),
          descricao: descricao.trim() || null,
          due_at: dueIso,
          assignee,
          notify,
          tipo,
        });
      } else {
        await createTask(
          {
            lead_id: finalLead,
            titulo: titulo.trim(),
            descricao: descricao.trim() || null,
            due_at: dueIso,
            assignee,
            notify,
            tipo,
          },
          user?.email ?? null,
        );
      }
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[92vh] w-full max-w-md flex-col rounded-xl border border-zinc-800 bg-zinc-950 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between border-b border-zinc-800 px-5 py-3">
          <div>
            <h2 className="text-base font-semibold text-zinc-100">
              {editing ? "Editar tarefa" : "Nova tarefa"}
            </h2>
            {lead && (
              <p className="text-[11px] text-zinc-500">
                vinculada a <span className="text-zinc-300">{lead.empresa || lead.nome}</span>
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            {linkedLead && linkedLead.telefone && !linkedLead.telefone.includes("@lid") && (
              <a
                href={whatsappLink(linkedLead.telefone)}
                target={WHATSAPP_TAB}
                className="flex items-center gap-1.5 rounded-md border border-[#25D366]/40 bg-[#25D366]/10 px-2.5 py-1.5 text-xs font-semibold text-[#25D366] hover:bg-[#25D366]/20"
                title="Abrir conversa no WhatsApp"
              >
                <WhatsAppIcon size={14} />
                WhatsApp
              </a>
            )}
            <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300" aria-label="Fechar">
              <X size={18} />
            </button>
          </div>
        </header>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto space-y-4 px-5 py-4">
          <Field label="Tipo de tarefa">
            <div className="flex flex-wrap gap-1.5">
              {TASK_TIPO_OPTIONS.map((t) => {
                const sel = tipo === t;
                const c = TASK_TIPO_COLORS[t];
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => pickTipo(t)}
                    className="rounded-md border px-3 py-1.5 text-xs font-medium transition-colors"
                    style={sel
                      ? { borderColor: `${c}88`, background: `${c}22`, color: c }
                      : { borderColor: "#2a2f3a", background: "#0f1218", color: "#9aa4b2" }}
                  >
                    {TASK_TIPO_ICONS[t]} {TASK_TIPO_LABELS[t]}
                  </button>
                );
              })}
            </div>
          </Field>

          <Field label="Título *">
            <input
              autoFocus
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              className="ds-task-input"
              placeholder="Ligar pra Maria, mandar proposta, …"
            />
          </Field>

          <Field label="Descrição">
            <textarea
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              rows={3}
              className="ds-task-input resize-y"
              placeholder="Detalhes da tarefa, contexto, próximos passos…"
            />
          </Field>

          <Field label="Quando *">
            <DateTimePicker
              date={dateStr}
              time={timeStr}
              onDateChange={setDateStr}
              onTimeChange={setTimeStr}
              showClear
            />
          </Field>

          <Field label="Responsável">
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => setAssignee(null)}
                className={`rounded-md border px-3 py-1.5 text-xs font-medium transition-colors ${
                  assignee === null
                    ? "border-zinc-700 bg-zinc-800 text-zinc-300"
                    : "border-zinc-800 bg-zinc-900 text-zinc-500 hover:border-zinc-700"
                }`}
              >
                —
              </button>
              {members.map((m) => {
                const sel = m.name === assignee;
                const color =
                  m.role === "SDR"
                    ? sel ? "border-sky-500/50 bg-sky-500/15 text-sky-200" : "border-zinc-800 bg-zinc-900 text-zinc-400 hover:border-zinc-700"
                    : sel ? "border-fuchsia-500/50 bg-fuchsia-500/15 text-fuchsia-200" : "border-zinc-800 bg-zinc-900 text-zinc-400 hover:border-zinc-700";
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setAssignee(m.name)}
                    className={`rounded-md border px-3 py-1.5 text-xs font-medium transition-colors ${color}`}
                  >
                    {m.name}
                  </button>
                );
              })}
            </div>
          </Field>

          {!lead && leadsForPicker.length > 0 && (
            <Field label="Vincular a um lead *">
              <select
                value={leadId ?? ""}
                onChange={(e) => setLeadId(e.target.value || null)}
                className="ds-task-input"
              >
                <option value="">— Selecione o lead —</option>
                {leadsForPicker.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.empresa || l.nome}
                  </option>
                ))}
              </select>
            </Field>
          )}

          <label className="flex items-center gap-2 text-xs text-zinc-400">
            <input
              type="checkbox"
              checked={notify}
              onChange={(e) => setNotify(e.target.checked)}
              className="accent-[#f5c518]"
            />
            Notificar no navegador na hora
          </label>

          {error && (
            <div className="rounded-md border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-300">
              {error}
            </div>
          )}
        </form>

        <footer className="flex justify-end gap-2 border-t border-zinc-800 px-5 py-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md px-4 py-2 text-sm text-zinc-400 hover:text-zinc-200"
          >
            Cancelar
          </button>
          <button
            type="submit"
            onClick={handleSubmit}
            disabled={saving}
            className="rounded-md bg-[#f5c518] px-4 py-2 text-sm font-semibold text-zinc-950 hover:bg-[#ffd633] disabled:opacity-50"
          >
            {saving ? "Salvando…" : editing ? "Salvar" : "Criar tarefa"}
          </button>
        </footer>

        <style jsx>{`
          .ds-task-input {
            width: 100%;
            background: #0f1218;
            border: 1px solid #2a2f3a;
            border-radius: 6px;
            padding: 8px 12px;
            color: #e7e9ee;
            font-size: 14px;
            outline: none;
            transition: border-color 0.15s;
          }
          .ds-task-input:focus { border-color: #f5c518; }
        `}</style>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-zinc-400">{label}</span>
      {children}
    </label>
  );
}
