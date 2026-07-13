"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { SegmentoSelect } from "@/components/ui/SegmentoSelect";
import { STATUS_LABELS, type Lead, type LeadStatus, type SegmentoConfeccao } from "@/lib/types";

type Props = {
  lead: Lead;
  targetStatus: LeadStatus;
  onCancel: () => void;
  onConfirm: (patch: Partial<Lead>) => Promise<void>;
};

// Pré qualificado = info do negócio (decisor, empresa, instagram, segmento).
// Obrigatória pra sair da Entrada. A qualificação/BANT vem só em "Qualificado".
export function CompletePreQualDialog({ lead, targetStatus, onCancel, onConfirm }: Props) {
  const [nome, setNome] = useState(lead.nome ?? "");
  const [empresa, setEmpresa] = useState(lead.empresa ?? "");
  const [instagram, setInstagram] = useState(lead.instagram ?? "");
  const [segmento, setSegmento] = useState<SegmentoConfeccao | null>(lead.segmento);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleConfirm() {
    if (!nome.trim() || !empresa.trim() || !instagram.trim() || !segmento) {
      setError("Preencha decisor, empresa, Instagram e segmento.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onConfirm({
        nome: nome.trim(),
        empresa: empresa.trim(),
        instagram: instagram.trim().replace(/^@/, ""),
        segmento,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar.");
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={onCancel}>
      <div className="flex max-h-[92vh] w-full max-w-md flex-col rounded-xl border border-zinc-800 bg-zinc-950 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <header className="flex items-center justify-between border-b border-zinc-800 px-5 py-3">
          <div>
            <h2 className="text-base font-semibold text-zinc-100">Informações do negócio</h2>
            <p className="text-[11px] text-zinc-500">
              Obrigatório para avançar para <span className="text-zinc-300">{STATUS_LABELS[targetStatus]}</span>
            </p>
          </div>
          <button onClick={onCancel} className="text-zinc-500 hover:text-zinc-300" aria-label="Fechar">
            <X size={18} />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          <Field label="Nome do decisor *">
            <input value={nome} onChange={(e) => setNome(e.target.value)} className="pq-input" placeholder="Ex: Maria Silva" />
          </Field>
          <Field label="Empresa *">
            <input value={empresa} onChange={(e) => setEmpresa(e.target.value)} className="pq-input" placeholder="Ex: Confecção Maria" />
          </Field>
          <Field label="Instagram *">
            <div className="flex items-center rounded-md border border-zinc-800 bg-[#0f1218] focus-within:border-[#f5c518]">
              <span className="pl-3 text-sm text-zinc-500">@</span>
              <input
                value={instagram}
                onChange={(e) => setInstagram(e.target.value.replace(/^@/, ""))}
                className="flex-1 bg-transparent px-2 py-2 text-sm text-zinc-100 outline-none"
                placeholder="perfil"
              />
            </div>
          </Field>
          <Field label="Segmento da confecção *">
            <SegmentoSelect value={segmento} onChange={setSegmento} />
          </Field>

          {error && (
            <div className="rounded-md border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-300">{error}</div>
          )}
        </div>

        <footer className="flex justify-end gap-2 border-t border-zinc-800 px-5 py-3">
          <button onClick={onCancel} type="button" className="rounded-md px-4 py-2 text-sm text-zinc-400 hover:text-zinc-200">
            Cancelar
          </button>
          <button
            onClick={handleConfirm}
            type="button"
            disabled={saving}
            className="rounded-md bg-[#f5c518] px-4 py-2 text-sm font-semibold text-zinc-950 hover:bg-[#ffd633] disabled:opacity-50"
          >
            {saving ? "Salvando…" : `Mover para ${STATUS_LABELS[targetStatus]}`}
          </button>
        </footer>

        <style jsx>{`
          .pq-input {
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
          .pq-input:focus { border-color: #f5c518; }
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
