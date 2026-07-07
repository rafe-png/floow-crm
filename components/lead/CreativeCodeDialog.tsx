"use client";

import { useState } from "react";
import { X } from "lucide-react";

/** Formata o código do criativo como [01], [02], … [100]. */
export function formatCreativeCode(n: number | null | undefined): string {
  if (n == null) return "—";
  return `[${String(n).padStart(2, "0")}]`;
}

const STEP = 10; // "mostre 10 por vez"

type PickerProps = {
  value: number | null;
  // null = remover a seleção (clicar no código já selecionado desmarca).
  onChange: (v: number | null) => void;
};

/** Grade de códigos: começa em 10, carrega +10, ou digita pra pular pra altos. */
export function CreativeCodePicker({ value, onChange }: PickerProps) {
  // Garante que o valor já escolhido (mesmo alto) caiba na grade.
  const [max, setMax] = useState(() => Math.max(STEP, value ? Math.ceil(value / STEP) * STEP : STEP));
  const [jump, setJump] = useState("");

  const codes = Array.from({ length: max }, (_, i) => i + 1);

  function applyJump() {
    const n = parseInt(jump, 10);
    if (Number.isNaN(n) || n < 1) return;
    if (n > max) setMax(Math.ceil(n / STEP) * STEP);
    onChange(n);
    setJump("");
  }

  return (
    <div>
      <div className="grid grid-cols-5 gap-1.5 sm:grid-cols-10">
        {codes.map((n) => {
          const selected = value === n;
          return (
            <button
              key={n}
              type="button"
              title={selected ? "Clique pra remover a seleção" : undefined}
              onClick={() => onChange(selected ? null : n)}
              className={`rounded-md border px-0 py-2 text-xs font-semibold tabular-nums transition-colors ${
                selected
                  ? "border-emerald-500/60 bg-emerald-500/20 text-emerald-200"
                  : "border-zinc-800 bg-zinc-900 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200"
              }`}
            >
              {String(n).padStart(2, "0")}
            </button>
          );
        })}
      </div>

      <div className="mt-3 flex items-center gap-2">
        <button
          type="button"
          onClick={() => setMax((m) => m + STEP)}
          className="rounded-md border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-xs text-zinc-300 hover:border-zinc-700"
        >
          Mostrar mais 10
        </button>
        {value != null && (
          <button
            type="button"
            onClick={() => onChange(null)}
            className="rounded-md border border-rose-500/30 bg-rose-500/10 px-3 py-1.5 text-xs text-rose-300 hover:border-rose-500/50"
          >
            Remover seleção
          </button>
        )}
        <div className="ml-auto flex items-center gap-1.5">
          <input
            value={jump}
            onChange={(e) => setJump(e.target.value.replace(/\D/g, ""))}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); applyJump(); } }}
            inputMode="numeric"
            placeholder="nº"
            className="w-16 rounded-md border border-zinc-800 bg-zinc-900 px-2 py-1.5 text-xs text-zinc-200 outline-none focus:border-[#f5c518]"
          />
          <button
            type="button"
            onClick={applyJump}
            className="rounded-md border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-xs text-zinc-300 hover:border-zinc-700"
          >
            Ir
          </button>
        </div>
      </div>
    </div>
  );
}

type DialogProps = {
  open: boolean;
  leadName: string;
  initial?: number | null;
  onCancel: () => void;
  /** Confirma com o código (ou null se "pular"). */
  onConfirm: (codigo: number | null) => Promise<void>;
};

/** Popup que pede o código do criativo antes de comemorar o negócio ganho. */
export function CreativeCodeDialog({ open, leadName, initial = null, onCancel, onConfirm }: DialogProps) {
  const [codigo, setCodigo] = useState<number | null>(initial);
  const [saving, setSaving] = useState(false);

  if (!open) return null;

  async function confirm(value: number | null) {
    setSaving(true);
    try {
      await onConfirm(value);
      setCodigo(null);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      onClick={onCancel}
    >
      <div
        className="flex max-h-[92vh] w-full max-w-lg flex-col rounded-xl border border-zinc-800 bg-zinc-950 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-start justify-between gap-3 border-b border-zinc-800 px-5 py-3">
          <div>
            <h2 className="text-base font-semibold text-zinc-100">Qual criativo trouxe esse cliente?</h2>
            <p className="mt-0.5 text-xs text-zinc-500">
              {leadName} · o código que aparece na conversa (ex: <span className="tabular-nums">[01]</span>)
            </p>
          </div>
          <button onClick={onCancel} className="text-zinc-500 hover:text-zinc-300" aria-label="Cancelar">
            <X size={18} />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          <CreativeCodePicker value={codigo} onChange={setCodigo} />
        </div>

        <footer className="flex items-center justify-between gap-2 border-t border-zinc-800 px-5 py-3">
          <button
            onClick={() => confirm(null)}
            type="button"
            disabled={saving}
            className="rounded-md px-3 py-2 text-sm text-zinc-500 hover:text-zinc-300 disabled:opacity-50"
          >
            Não sei / pular
          </button>
          <button
            onClick={() => confirm(codigo)}
            type="button"
            disabled={codigo == null || saving}
            className="rounded-md bg-emerald-500 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-400 disabled:opacity-50"
          >
            {saving ? "Salvando…" : `Confirmar ${codigo != null ? formatCreativeCode(codigo) : ""}`}
          </button>
        </footer>
      </div>
    </div>
  );
}
