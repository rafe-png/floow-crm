"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { CargoSelect } from "@/components/ui/CargoSelect";
import { DateTimePicker, joinIso } from "@/components/ui/DateTimePicker";
import { LocalSelect } from "@/components/ui/LocalSelect";
import { PersonSelect } from "@/components/ui/PersonSelect";
import { useTeamContext } from "@/lib/contexts/TeamContext";
import {
  BANT_AUTHORITY_LABELS,
  BANT_BUDGET_LABELS,
  BANT_NEED_LABELS,
  BANT_TIMING_LABELS,
  ESTOQUE_LABELS,
  ESTRUTURA_LABELS,
  HISTORICO_LABELS,
  type BantAuthority,
  type BantBudget,
  type BantNeed,
  type BantTiming,
  type EstoqueNivel,
  type EstruturaComercial,
  type HistoricoTrafego,
  type LocalReuniao,
  type Owner,
} from "@/lib/types";
import type { NewLeadInput } from "@/lib/hooks/useLeads";

type Props = {
  open: boolean;
  onClose: () => void;
  onSubmit: (input: NewLeadInput) => Promise<void>;
};

export function NewLeadDialog({ open, onClose, onSubmit }: Props) {
  if (!open) return null;
  return <NewLeadDialogBody onClose={onClose} onSubmit={onSubmit} />;
}

function NewLeadDialogBody({
  onClose,
  onSubmit,
}: {
  onClose: () => void;
  onSubmit: (input: NewLeadInput) => Promise<void>;
}) {
  const { defaultFor } = useTeamContext();

  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [cargo, setCargo] = useState<string | null>(null);
  const [empresa, setEmpresa] = useState("");
  const [instagram, setInstagram] = useState("");
  const [dono, setDono] = useState<Owner>("SDR");
  const [valor, setValor] = useState("");
  const [sdrResp, setSdrResp] = useState<string | null>(() => defaultFor("SDR")?.name ?? null);
  const [closerResp, setCloserResp] = useState<string | null>(() => defaultFor("Closer")?.name ?? null);

  const [estoque, setEstoque] = useState<EstoqueNivel | null>(null);
  const [historico, setHistorico] = useState<HistoricoTrafego | null>(null);
  const [estrutura, setEstrutura] = useState<EstruturaComercial | null>(null);

  const [bantBudget, setBantBudget] = useState<BantBudget | null>(null);
  const [bantAuthority, setBantAuthority] = useState<BantAuthority | null>(null);
  const [bantNeed, setBantNeed] = useState<BantNeed | null>(null);
  const [bantTiming, setBantTiming] = useState<BantTiming | null>(null);

  const [data, setData] = useState("");
  const [hora, setHora] = useState("");
  const [local, setLocal] = useState<LocalReuniao | null>(null);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setNome(""); setTelefone(""); setCargo(null); setEmpresa(""); setInstagram("");
    setDono("SDR"); setValor("");
    setSdrResp(defaultFor("SDR")?.name ?? null);
    setCloserResp(defaultFor("Closer")?.name ?? null);
    setEstoque(null); setHistorico(null); setEstrutura(null);
    setBantBudget(null); setBantAuthority(null); setBantNeed(null); setBantTiming(null);
    setData(""); setHora(""); setLocal(null);
    setError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!nome.trim() || !telefone.trim() || !empresa.trim()) {
      setError("Nome do decisor, telefone e empresa são obrigatórios.");
      return;
    }
    if (!estoque || !historico || !estrutura) {
      setError("Preencha a qualificação (estoque, histórico, estrutura).");
      return;
    }
    if (!bantBudget || !bantAuthority || !bantNeed || !bantTiming) {
      setError("Preencha todos os 4 campos do BANT.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const parsedValor = valor.trim() ? Number(valor.replace(/\./g, "").replace(",", ".")) : null;
      const dataAgendamento = joinIso(data, hora);

      await onSubmit({
        nome: nome.trim(),
        telefone: telefone.trim(),
        cargo: cargo,
        empresa: empresa.trim() || null,
        instagram: instagram.trim().replace(/^@/, "") || null,
        dono,
        valor: parsedValor != null && !Number.isNaN(parsedValor) ? parsedValor : null,
        sdr_responsavel: sdrResp,
        closer_responsavel: closerResp,
        estoque,
        historico,
        estrutura,
        bant_budget: bantBudget,
        bant_authority: bantAuthority,
        bant_need: bantNeed,
        bant_timing: bantTiming,
        data_agendamento: dataAgendamento,
        local,
      });
      reset();
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
        className="flex max-h-[92vh] w-full max-w-2xl flex-col rounded-xl border border-zinc-800 bg-zinc-950 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between border-b border-zinc-800 px-5 py-3">
          <div>
            <h2 className="text-base font-semibold text-zinc-100">Novo lead</h2>
            <p className="text-[11px] text-zinc-500">Preencha durante a ligação · ~60s</p>
          </div>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300" aria-label="Fechar">
            <X size={18} />
          </button>
        </header>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          {/* Decisor */}
          <Section title="Decisor">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Nome *">
                <input autoFocus value={nome} onChange={(e) => setNome(e.target.value)} className="ds-input" placeholder="Maria Silva" />
              </Field>
              <Field label="WhatsApp *">
                <input value={telefone} onChange={(e) => setTelefone(e.target.value)} className="ds-input" placeholder="(11) 91234-5678" inputMode="tel" />
              </Field>
              <Field label="Cargo">
                <CargoSelect value={cargo} onChange={setCargo} />
              </Field>
              <Field label="Dono no CRM">
                <Pills
                  value={dono}
                  options={[
                    { value: "SDR" as Owner, label: "SDR", color: "sky" },
                    { value: "Closer" as Owner, label: "Closer", color: "fuchsia" },
                  ]}
                  onChange={setDono}
                />
              </Field>
            </div>
          </Section>

          {/* Responsáveis */}
          <Section title="Responsáveis" hint="Auto-preenchido com base no usuário logado (pós-login)">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="SDR responsável">
                <PersonSelect role="SDR" value={sdrResp} onChange={setSdrResp} />
              </Field>
              <Field label="Closer responsável">
                <PersonSelect role="Closer" value={closerResp} onChange={setCloserResp} />
              </Field>
            </div>
          </Section>

          {/* Empresa */}
          <Section title="Empresa">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Nome da empresa *">
                <input value={empresa} onChange={(e) => setEmpresa(e.target.value)} className="ds-input" placeholder="Confecção XYZ" />
              </Field>
              <Field label="Instagram">
                <div className="flex items-center rounded-md border border-zinc-800 bg-[#0f1218] focus-within:border-[#f5c518]">
                  <span className="pl-3 text-sm text-zinc-500">@</span>
                  <input value={instagram} onChange={(e) => setInstagram(e.target.value.replace(/^@/, ""))} className="flex-1 bg-transparent px-2 py-2 text-sm text-zinc-100 outline-none" placeholder="empresa" />
                </div>
              </Field>
            </div>
          </Section>

          {/* Qualificação */}
          <Section title="Qualificação *" hint="Toque rápido nas opções">
            <div className="space-y-3">
              <PillRow
                label="Estoque pronta entrega"
                value={estoque}
                options={Object.entries(ESTOQUE_LABELS).map(([v, l]) => ({ value: v as EstoqueNivel, label: l }))}
                onChange={setEstoque}
              />
              <PillRow
                label="Histórico de tráfego pago"
                value={historico}
                options={Object.entries(HISTORICO_LABELS).map(([v, l]) => ({ value: v as HistoricoTrafego, label: l }))}
                onChange={setHistorico}
              />
              <PillRow
                label="Estrutura comercial"
                value={estrutura}
                options={Object.entries(ESTRUTURA_LABELS).map(([v, l]) => ({ value: v as EstruturaComercial, label: l }))}
                onChange={setEstrutura}
              />
            </div>
          </Section>

          {/* BANT */}
          <Section title="BANT *" hint="Obrigatório · 4 toques">
            <div className="space-y-3">
              <PillRow
                label="💰 Budget"
                value={bantBudget}
                options={Object.entries(BANT_BUDGET_LABELS).map(([v, l]) => ({ value: v as BantBudget, label: l }))}
                onChange={setBantBudget}
              />
              <PillRow
                label="🎯 Authority"
                value={bantAuthority}
                options={Object.entries(BANT_AUTHORITY_LABELS).map(([v, l]) => ({ value: v as BantAuthority, label: l }))}
                onChange={setBantAuthority}
              />
              <PillRow
                label="🔥 Need (dor)"
                value={bantNeed}
                options={Object.entries(BANT_NEED_LABELS).map(([v, l]) => ({ value: v as BantNeed, label: l }))}
                onChange={setBantNeed}
              />
              <PillRow
                label="⏱️ Timing"
                value={bantTiming}
                options={Object.entries(BANT_TIMING_LABELS).map(([v, l]) => ({ value: v as BantTiming, label: l }))}
                onChange={setBantTiming}
              />
            </div>
          </Section>

          {/* Agendamento + Valor */}
          <Section title="Agendamento da reunião" hint="Opcional na criação · pode preencher depois">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-[2fr_1fr]">
              <div>
                <span className="mb-1 block text-xs font-medium text-zinc-400">Quando</span>
                <DateTimePicker
                  date={data}
                  time={hora}
                  onDateChange={setData}
                  onTimeChange={setHora}
                  showClear
                />
              </div>
              <Field label="Valor estimado">
                <input value={valor} onChange={(e) => setValor(e.target.value)} className="ds-input" placeholder="R$ 0,00" inputMode="decimal" />
              </Field>
            </div>
            <Field label="Local">
              <LocalSelect value={local} onChange={setLocal} />
            </Field>
          </Section>

          {error && (
            <div className="rounded-md border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-300">
              {error}
            </div>
          )}
        </form>

        <footer className="flex justify-end gap-2 border-t border-zinc-800 px-5 py-3">
          <button onClick={onClose} type="button" className="rounded-md px-4 py-2 text-sm text-zinc-400 hover:text-zinc-200">
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            type="submit"
            disabled={saving}
            className="rounded-md bg-[#f5c518] px-4 py-2 text-sm font-semibold text-zinc-950 hover:bg-[#ffd633] disabled:opacity-50"
          >
            {saving ? "Salvando…" : "Criar lead"}
          </button>
        </footer>
      </div>

      <style jsx>{`
        .ds-input {
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
        .ds-input:focus { border-color: #f5c518; }
      `}</style>
    </div>
  );
}

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section>
      <div className="mb-2 flex items-baseline justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">{title}</h3>
        {hint && <span className="text-[10px] text-zinc-600">{hint}</span>}
      </div>
      {children}
    </section>
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

type PillOption<T> = { value: T; label: string; color?: "sky" | "fuchsia" };

function Pills<T extends string>({
  value, options, onChange,
}: { value: T | null; options: PillOption<T>[]; onChange: (v: T) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((opt) => {
        const selected = opt.value === value;
        const colorClass = selected
          ? opt.color === "sky"
            ? "border-sky-500/50 bg-sky-500/15 text-sky-200"
            : opt.color === "fuchsia"
            ? "border-fuchsia-500/50 bg-fuchsia-500/15 text-fuchsia-200"
            : "border-[#f5c518]/50 bg-[#f5c518]/15 text-[#f5c518]"
          : "border-zinc-800 bg-zinc-900 text-zinc-400 hover:border-zinc-700";
        return (
          <button
            key={String(opt.value)}
            type="button"
            onClick={() => onChange(opt.value)}
            className={`rounded-md border px-3 py-1.5 text-xs font-medium transition-colors ${colorClass}`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

function PillRow<T extends string>({
  label, value, options, onChange,
}: { label: string; value: T | null; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div>
      <div className="mb-1 text-[11px] font-medium text-zinc-400">{label}</div>
      <Pills value={value} options={options} onChange={onChange} />
    </div>
  );
}
