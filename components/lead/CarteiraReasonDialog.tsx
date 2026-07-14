"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { MOTIVO_CARTEIRA_LABELS, type MotivoCarteira } from "@/lib/types";

type Props = {
  open: boolean;
  leadName: string;
  onCancel: () => void;
  onConfirm: (motivo: MotivoCarteira) => Promise<void>;
};

// Popup obrigatório ao mandar o lead pra Carteira (estacionamento). Depois de
// registrar o motivo, o funil abre a criação de uma tarefa de recontato.
export function CarteiraReasonDialog({ open, leadName, onCancel, onConfirm }: Props) {
  const [motivo, setMotivo] = useState<MotivoCarteira | null>(null);
  const [saving, setSaving] = useState(false);

  if (!open) return null;

  async function handleConfirm() {
    if (!motivo) return;
    setSaving(true);
    try {
      await onConfirm(motivo);
      setMotivo(null);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={onCancel}>
      <div className="w-full max-w-md rounded-xl border border-zinc-800 bg-zinc-950 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <header className="flex items-start justify-between gap-3 border-b border-zinc-800 px-5 py-3">
          <div>
            <h2 className="text-base font-semibold text-zinc-100">Por que foi pra Carteira?</h2>
            <p className="mt-0.5 text-xs text-zinc-500">
              {leadName} · em seguida você agenda a tarefa de recontato
            </p>
          </div>
          <button onClick={onCancel} className="text-zinc-500 hover:text-zinc-300" aria-label="Cancelar">
            <X size={18} />
          </button>
        </header>

        <div className="px-5 py-4">
          <div className="flex flex-wrap gap-1.5">
            {(Object.keys(MOTIVO_CARTEIRA_LABELS) as MotivoCarteira[]).map((opt) => {
              const selected = motivo === opt;
              return (
                <button
                  key={opt}
                  type="button"
                  onClick={() => setMotivo(opt)}
                  className={`rounded-md border px-3 py-2 text-xs font-medium transition-colors ${
                    selected
                      ? "border-cyan-400/50 bg-cyan-400/15 text-cyan-200"
                      : "border-zinc-800 bg-zinc-900 text-zinc-400 hover:border-zinc-700"
                  }`}
                >
                  {MOTIVO_CARTEIRA_LABELS[opt]}
                </button>
              );
            })}
          </div>
        </div>

        <footer className="flex justify-end gap-2 border-t border-zinc-800 px-5 py-3">
          <button onClick={onCancel} type="button" className="rounded-md px-4 py-2 text-sm text-zinc-400 hover:text-zinc-200">
            Cancelar
          </button>
          <button
            onClick={handleConfirm}
            disabled={!motivo || saving}
            className="rounded-md bg-cyan-500 px-4 py-2 text-sm font-semibold text-white hover:bg-cyan-400 disabled:opacity-50"
          >
            {saving ? "Salvando…" : "Mover e agendar tarefa"}
          </button>
        </footer>
      </div>
    </div>
  );
}
