"use client";

import { useMemo, useState } from "react";
import { X } from "lucide-react";
import { DateTimePicker, busyStartsForDate, joinIso, splitIso } from "@/components/ui/DateTimePicker";
import { useLeadsContext } from "@/lib/contexts/LeadsContext";
import { LOCAL_ICONS, LOCAL_LABELS, type LocalReuniao } from "@/lib/types";

type Props = {
  open: boolean;
  leadName: string;
  closers: { id: string; name: string }[];
  initialCloser?: string | null;
  initialDate?: string | null; // ISO do agendamento atual (re-agendar)
  initialLocal?: LocalReuniao | null;
  onCancel: () => void;
  onConfirm: (closerName: string, dataAgendamentoIso: string, local: LocalReuniao) => Promise<void>;
};

const LOCAL_OPTIONS = Object.keys(LOCAL_LABELS) as LocalReuniao[];

// Popup obrigatório ao agendar a reunião: Closer responsável + data/hora + local.
// (O SDR continua como responsável de pré-vendas — não é alterado aqui.)
export function CloserSelectDialog({
  open, leadName, closers, initialCloser, initialDate, initialLocal, onCancel, onConfirm,
}: Props) {
  const { leads } = useLeadsContext();
  const init = splitIso(initialDate ?? null);

  const [sel, setSel] = useState<string | null>(initialCloser ?? null);
  const [dateStr, setDateStr] = useState(init.date);
  const [timeStr, setTimeStr] = useState(init.time);
  const [local, setLocal] = useState<LocalReuniao | null>(initialLocal ?? null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const busyStarts = useMemo(() => busyStartsForDate(leads, dateStr), [leads, dateStr]);

  if (!open) return null;

  async function handleConfirm() {
    const iso = joinIso(dateStr, timeStr);
    if (!sel) { setError("Escolha o Closer responsável."); return; }
    if (!iso) { setError("Escolha a data e a hora da reunião."); return; }
    if (!local) { setError("Escolha o local da reunião."); return; }
    setSaving(true);
    setError(null);
    try {
      await onConfirm(sel, iso, local);
      setSel(null);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm" onClick={onCancel}>
      <div className="flex max-h-[92vh] w-full max-w-md flex-col rounded-xl border border-zinc-800 bg-zinc-950 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <header className="flex items-start justify-between gap-3 border-b border-zinc-800 px-5 py-3">
          <div>
            <h2 className="text-base font-semibold text-zinc-100">Agendar reunião</h2>
            <p className="mt-0.5 text-xs text-zinc-500">{leadName} · Closer e data são obrigatórios</p>
          </div>
          <button onClick={onCancel} className="text-zinc-500 hover:text-zinc-300" aria-label="Cancelar">
            <X size={18} />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          <div>
            <span className="mb-1.5 block text-xs font-medium text-zinc-400">Closer responsável *</span>
            {closers.length === 0 ? (
              <p className="text-xs text-zinc-500">Nenhum Closer cadastrado. Cadastre em Configurações.</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {closers.map((c) => {
                  const selected = sel === c.name;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setSel(c.name)}
                      className={`rounded-md border px-3 py-2 text-sm font-medium transition-colors ${
                        selected
                          ? "border-fuchsia-500/50 bg-fuchsia-500/15 text-fuchsia-200"
                          : "border-zinc-800 bg-zinc-900 text-zinc-400 hover:border-zinc-700"
                      }`}
                    >
                      {c.name}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div>
            <span className="mb-1.5 block text-xs font-medium text-zinc-400">Data e hora da reunião *</span>
            <DateTimePicker
              date={dateStr}
              time={timeStr}
              onDateChange={setDateStr}
              onTimeChange={setTimeStr}
              busyStarts={busyStarts}
            />
          </div>

          <div>
            <span className="mb-1.5 block text-xs font-medium text-zinc-400">Local da reunião *</span>
            <div className="flex flex-wrap gap-1.5">
              {LOCAL_OPTIONS.map((l) => {
                const selected = local === l;
                return (
                  <button
                    key={l}
                    type="button"
                    onClick={() => setLocal(l)}
                    className={`rounded-md border px-3 py-2 text-sm font-medium transition-colors ${
                      selected
                        ? "border-fuchsia-500/50 bg-fuchsia-500/15 text-fuchsia-200"
                        : "border-zinc-800 bg-zinc-900 text-zinc-400 hover:border-zinc-700"
                    }`}
                  >
                    {LOCAL_ICONS[l]} {LOCAL_LABELS[l]}
                  </button>
                );
              })}
            </div>
          </div>

          {error && (
            <div className="rounded-md border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-300">
              {error}
            </div>
          )}
        </div>

        <footer className="flex justify-end gap-2 border-t border-zinc-800 px-5 py-3">
          <button onClick={onCancel} type="button" className="rounded-md px-4 py-2 text-sm text-zinc-400 hover:text-zinc-200">
            Cancelar
          </button>
          <button
            onClick={handleConfirm}
            disabled={!sel || !dateStr || !timeStr || !local || saving}
            className="rounded-md bg-fuchsia-500 px-4 py-2 text-sm font-semibold text-white hover:bg-fuchsia-400 disabled:opacity-50"
          >
            {saving ? "Salvando…" : "Confirmar reunião"}
          </button>
        </footer>
      </div>
    </div>
  );
}
