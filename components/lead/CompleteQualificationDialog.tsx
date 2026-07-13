"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { PillRow } from "@/components/ui/Pills";
import {
  BANT_AUTHORITY_LABELS,
  BANT_BUDGET_LABELS,
  BANT_NEED_LABELS,
  BANT_TIMING_LABELS,
  CANAL_VENDAS_LABELS,
  ESTOQUE_LABELS,
  ESTRUTURA_LABELS,
  EXPERIENCIA_LABELS,
  HISTORICO_LABELS,
  PRODUTO_LABELS,
  PRODUTO_VALORES,
  SITUACAO_LABELS,
  STATUS_LABELS,
  type BantAuthority,
  type BantBudget,
  type BantNeed,
  type BantTiming,
  type CanalVendas,
  type EstoqueNivel,
  type EstruturaComercial,
  type Experiencia,
  type HistoricoTrafego,
  type Lead,
  type LeadProduto,
  type LeadStatus,
  type Situacao,
} from "@/lib/types";

type Props = {
  lead: Lead;
  targetStatus: LeadStatus;
  onCancel: () => void;
  onConfirm: (patch: Partial<Lead>) => Promise<void>;
};

export function CompleteQualificationDialog({ lead, targetStatus, onCancel, onConfirm }: Props) {
  const [produto, setProduto] = useState<LeadProduto | null>(lead.produto);
  const [experiencia, setExperiencia] = useState<Experiencia | null>(lead.experiencia);
  const [situacao, setSituacao] = useState<Situacao | null>(lead.situacao);
  const [canalVendas, setCanalVendas] = useState<CanalVendas | null>(lead.canal_vendas);
  const [estoque, setEstoque] = useState<EstoqueNivel | null>(lead.estoque);
  const [historico, setHistorico] = useState<HistoricoTrafego | null>(lead.historico);
  const [estrutura, setEstrutura] = useState<EstruturaComercial | null>(lead.estrutura);
  const [bantBudget, setBantBudget] = useState<BantBudget | null>(lead.bant_budget);
  const [bantAuthority, setBantAuthority] = useState<BantAuthority | null>(lead.bant_authority);
  const [bantNeed, setBantNeed] = useState<BantNeed | null>(lead.bant_need);
  const [bantTiming, setBantTiming] = useState<BantTiming | null>(lead.bant_timing);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleConfirm() {
    if (!produto) {
      setError("Selecione o produto ofertado.");
      return;
    }
    if (!experiencia || !situacao || !canalVendas || !estoque || !historico || !estrutura) {
      setError("Preencha toda a qualificação (experiência, situação, canal, estoque, histórico, estrutura).");
      return;
    }
    if (!bantBudget || !bantAuthority || !bantNeed || !bantTiming) {
      setError("Preencha todos os 4 campos do BANT.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onConfirm({
        produto,
        experiencia,
        situacao,
        canal_vendas: canalVendas,
        estoque,
        historico,
        estrutura,
        bant_budget: bantBudget,
        bant_authority: bantAuthority,
        bant_need: bantNeed,
        bant_timing: bantTiming,
        // Pré-preenche o valor sugerido do produto se o lead ainda não tem valor
        // (não sobrescreve um valor já editado à mão).
        ...(lead.valor == null ? { valor: PRODUTO_VALORES[produto] } : {}),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar.");
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      onClick={onCancel}
    >
      <div
        className="flex max-h-[92vh] w-full max-w-xl flex-col rounded-xl border border-zinc-800 bg-zinc-950 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between border-b border-zinc-800 px-5 py-3">
          <div>
            <h2 className="text-base font-semibold text-zinc-100">Complete a qualificação</h2>
            <p className="text-[11px] text-zinc-500">
              Obrigatório para avançar para{" "}
              <span className="text-zinc-300">{STATUS_LABELS[targetStatus]}</span>
            </p>
          </div>
          <button onClick={onCancel} className="text-zinc-500 hover:text-zinc-300" aria-label="Fechar">
            <X size={18} />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          <section className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Qualificação</h3>
            <PillRow label="🏷️ Produto ofertado" value={produto}
              options={Object.entries(PRODUTO_LABELS).map(([v, l]) => ({ value: v as LeadProduto, label: l }))}
              onChange={setProduto} />
            <PillRow label="Experiência (tempo de mercado)" value={experiencia}
              options={Object.entries(EXPERIENCIA_LABELS).map(([v, l]) => ({ value: v as Experiencia, label: l }))}
              onChange={setExperiencia} />
            <PillRow label="Situação atual" value={situacao}
              options={Object.entries(SITUACAO_LABELS).map(([v, l]) => ({ value: v as Situacao, label: l }))}
              onChange={setSituacao} />
            <PillRow label="Canal de vendas" value={canalVendas}
              options={Object.entries(CANAL_VENDAS_LABELS).map(([v, l]) => ({ value: v as CanalVendas, label: l }))}
              onChange={setCanalVendas} />
            <PillRow label="Estoque pronta entrega" value={estoque}
              options={Object.entries(ESTOQUE_LABELS).map(([v, l]) => ({ value: v as EstoqueNivel, label: l }))}
              onChange={setEstoque} />
            <PillRow label="Histórico de tráfego pago" value={historico}
              options={Object.entries(HISTORICO_LABELS).map(([v, l]) => ({ value: v as HistoricoTrafego, label: l }))}
              onChange={setHistorico} />
            <PillRow label="Estrutura comercial" value={estrutura}
              options={Object.entries(ESTRUTURA_LABELS).map(([v, l]) => ({ value: v as EstruturaComercial, label: l }))}
              onChange={setEstrutura} />
          </section>

          <section className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">BANT</h3>
            <PillRow label="💰 Budget" value={bantBudget}
              options={Object.entries(BANT_BUDGET_LABELS).map(([v, l]) => ({ value: v as BantBudget, label: l }))}
              onChange={setBantBudget} />
            <PillRow label="🎯 Authority" value={bantAuthority}
              options={Object.entries(BANT_AUTHORITY_LABELS).map(([v, l]) => ({ value: v as BantAuthority, label: l }))}
              onChange={setBantAuthority} />
            <PillRow label="🔥 Need (dor)" value={bantNeed}
              options={Object.entries(BANT_NEED_LABELS).map(([v, l]) => ({ value: v as BantNeed, label: l }))}
              onChange={setBantNeed} />
            <PillRow label="⏱️ Timing" value={bantTiming}
              options={Object.entries(BANT_TIMING_LABELS).map(([v, l]) => ({ value: v as BantTiming, label: l }))}
              onChange={setBantTiming} />
          </section>

          {error && (
            <div className="rounded-md border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-300">
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
            type="button"
            disabled={saving}
            className="rounded-md bg-[#f5c518] px-4 py-2 text-sm font-semibold text-zinc-950 hover:bg-[#ffd633] disabled:opacity-50"
          >
            {saving ? "Salvando…" : `Mover para ${STATUS_LABELS[targetStatus]}`}
          </button>
        </footer>
      </div>
    </div>
  );
}
