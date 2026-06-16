"use client";

import { useState } from "react";
import { X } from "lucide-react";

type Props = {
  open: boolean;
  leadName: string;
  closers: { id: string; name: string }[];
  initial?: string | null;
  onCancel: () => void;
  onConfirm: (closerName: string) => Promise<void>;
};

// Popup obrigatório ao agendar a reunião: define o Closer responsável.
// (O SDR continua como responsável de pré-vendas — não é alterado aqui.)
export function CloserSelectDialog({ open, leadName, closers, initial, onCancel, onConfirm }: Props) {
  const [sel, setSel] = useState<string | null>(initial ?? null);
  const [saving, setSaving] = useState(false);

  if (!open) return null;

  async function handleConfirm() {
    if (!sel) return;
    setSaving(true);
    try {
      await onConfirm(sel);
      setSel(null);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm" onClick={onCancel}>
      <div className="w-full max-w-md rounded-xl border border-zinc-800 bg-zinc-950 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <header className="flex items-start justify-between gap-3 border-b border-zinc-800 px-5 py-3">
          <div>
            <h2 className="text-base font-semibold text-zinc-100">Quem vai fazer essa reunião?</h2>
            <p className="mt-0.5 text-xs text-zinc-500">{leadName} · escolha o Closer responsável</p>
          </div>
          <button onClick={onCancel} className="text-zinc-500 hover:text-zinc-300" aria-label="Cancelar">
            <X size={18} />
          </button>
        </header>

        <div className="px-5 py-4">
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

        <footer className="flex justify-end gap-2 border-t border-zinc-800 px-5 py-3">
          <button onClick={onCancel} type="button" className="rounded-md px-4 py-2 text-sm text-zinc-400 hover:text-zinc-200">
            Cancelar
          </button>
          <button
            onClick={handleConfirm}
            disabled={!sel || saving}
            className="rounded-md bg-fuchsia-500 px-4 py-2 text-sm font-semibold text-white hover:bg-fuchsia-400 disabled:opacity-50"
          >
            {saving ? "Salvando…" : "Confirmar reunião"}
          </button>
        </footer>
      </div>
    </div>
  );
}
