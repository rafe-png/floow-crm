"use client";

import { useMemo, useState } from "react";
import { X } from "lucide-react";
import { DateTimePicker, busyStartsForDate, joinIso } from "@/components/ui/DateTimePicker";
import { LocalSelect } from "@/components/ui/LocalSelect";
import { PersonSelect } from "@/components/ui/PersonSelect";
import { PillRow } from "@/components/ui/Pills";
import { SegmentoSelect } from "@/components/ui/SegmentoSelect";
import { EstadoCidadeSelect } from "@/components/ui/EstadoCidadeSelect";
import { useLeadsContext } from "@/lib/contexts/LeadsContext";
import { useTeamContext } from "@/lib/contexts/TeamContext";
import { useAdCodes, codeToLeadFields } from "@/lib/hooks/useAdCodes";
import {
  BANT_AUTHORITY_LABELS,
  BANT_BUDGET_LABELS,
  BANT_NEED_LABELS,
  BANT_TIMING_LABELS,
  CANAL_VENDAS_LABELS,
  ESTOQUE_LABELS,
  ESTRUTURA_LABELS,
  EXPERIENCIA_LABELS,
  FONTE_LABELS,
  FONTE_OPTIONS,
  HISTORICO_LABELS,
  SITUACAO_LABELS,
  findDuplicateLead,
  STATUS_COLORS,
  STATUS_LABELS,
  type Lead,
  type BantAuthority,
  type BantBudget,
  type BantNeed,
  type BantTiming,
  type CanalVendas,
  type EstoqueNivel,
  type EstruturaComercial,
  type Experiencia,
  type HistoricoTrafego,
  type LeadFonte,
  type LeadStatus,
  type LocalReuniao,
  type SegmentoConfeccao,
  type Situacao,
} from "@/lib/types";
import type { NewLeadInput } from "@/lib/hooks/useLeads";

type SubmitInput = NewLeadInput & { status?: LeadStatus };

type Props = {
  open: boolean;
  onClose: () => void;
  onSubmit: (input: SubmitInput) => Promise<void>;
  initialStatus?: LeadStatus;
  /** Abrir o lead já existente quando o contato for duplicado */
  onOpenExisting?: (lead: Lead) => void;
};

export function NewLeadDialog({ open, onClose, onSubmit, initialStatus, onOpenExisting }: Props) {
  if (!open) return null;
  return (
    <NewLeadDialogBody
      onClose={onClose}
      onSubmit={onSubmit}
      initialStatus={initialStatus}
      onOpenExisting={onOpenExisting}
    />
  );
}

function NewLeadDialogBody({
  onClose,
  onSubmit,
  initialStatus,
  onOpenExisting,
}: {
  onClose: () => void;
  onSubmit: (input: SubmitInput) => Promise<void>;
  initialStatus?: LeadStatus;
  onOpenExisting?: (lead: Lead) => void;
}) {
  const { currentMember } = useTeamContext();
  const { leads } = useLeadsContext();
  const adCodes = useAdCodes();

  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [empresa, setEmpresa] = useState("");
  const [instagram, setInstagram] = useState("");
  const [segmento, setSegmento] = useState<SegmentoConfeccao | null>(null);
  const [cidade, setCidade] = useState<string | null>(null);
  const [estado, setEstado] = useState<string | null>(null);
  const [fonte, setFonte] = useState<LeadFonte | null>(null);
  const [criativo, setCriativo] = useState<string>(""); // código do anúncio (opcional)
  const [valor, setValor] = useState("");

  // SDR responsável = usuário logado (quem está cadastrando). Closer só é
  // definido depois, ao agendar a reunião (não pré-atribui aqui).
  const [sdrResp, setSdrResp] = useState<string | null>(() => currentMember?.name ?? null);
  const [closerResp, setCloserResp] = useState<string | null>(null);

  const [experiencia, setExperiencia] = useState<Experiencia | null>(null);
  const [situacao, setSituacao] = useState<Situacao | null>(null);
  const [canalVendas, setCanalVendas] = useState<CanalVendas | null>(null);
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

  const busyStarts = useMemo(() => busyStartsForDate(leads, data), [leads, data]);

  // Lead já cadastrado com o mesmo contato (telefone ou @instagram).
  const duplicate = useMemo(
    () => findDuplicateLead(leads, { telefone, instagram }),
    [leads, telefone, instagram],
  );

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setNome(""); setTelefone(""); setEmpresa(""); setInstagram("");
    setSegmento(null);
    setCidade(null); setEstado(null); setFonte(null); setCriativo("");
    setValor("");
    setSdrResp(currentMember?.name ?? null);
    setCloserResp(null);
    setExperiencia(null); setSituacao(null); setCanalVendas(null);
    setEstoque(null); setHistorico(null); setEstrutura(null);
    setBantBudget(null); setBantAuthority(null); setBantNeed(null); setBantTiming(null);
    setData(""); setHora(""); setLocal(null);
    setError(null);
  }

  // Modo enxuto: criar direto na etapa "Qualificado" só pede contato do decisor + empresa.
  const quick = initialStatus === "qualificado";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!nome.trim() || !telefone.trim()) {
      setError("Nome do decisor e contato (WhatsApp) são obrigatórios.");
      return;
    }
    if (!quick && !empresa.trim()) {
      setError("Nome da empresa é obrigatório.");
      return;
    }
    if (!quick && (!cidade?.trim() || !estado)) {
      setError("Selecione a cidade (e a UF, se for 'Outra').");
      return;
    }
    if (!quick && !fonte) {
      setError("Selecione a origem (fonte de marketing).");
      return;
    }
    if (duplicate) {
      setError(
        `Esse contato já está cadastrado em "${duplicate.empresa || duplicate.nome}". Não dá pra duplicar.`,
      );
      return;
    }
    if (!quick) {
      if (!experiencia || !situacao || !canalVendas || !estoque || !historico || !estrutura) {
        setError("Preencha toda a qualificação (experiência, situação, canal, estoque, histórico, estrutura).");
        return;
      }
      if (!bantBudget || !bantAuthority || !bantNeed || !bantTiming) {
        setError("Preencha todos os 4 campos do BANT.");
        return;
      }
    }

    setSaving(true);
    setError(null);
    try {
      const parsedValor = valor.trim() ? Number(valor.replace(/\./g, "").replace(",", ".")) : null;
      const dataAgendamento = quick ? null : joinIso(data, hora);

      await onSubmit({
        nome: nome.trim(),
        telefone: telefone.trim(),
        empresa: empresa.trim() || null,
        instagram: instagram.trim().replace(/^@/, "") || null,
        segmento: quick ? null : segmento,
        cidade: quick ? null : (cidade?.trim() || null),
        estado: quick ? null : estado,
        fonte: quick ? null : fonte,
        ...codeToLeadFields(criativo), // criativo/anúncio (opcional) — vale nos 2 modos
        valor: quick ? null : (parsedValor != null && !Number.isNaN(parsedValor) ? parsedValor : null),
        sdr_responsavel: sdrResp,
        closer_responsavel: closerResp,
        experiencia: quick ? null : experiencia,
        situacao: quick ? null : situacao,
        canal_vendas: quick ? null : canalVendas,
        estoque: quick ? null : estoque,
        historico: quick ? null : historico,
        estrutura: quick ? null : estrutura,
        bant_budget: quick ? null : bantBudget,
        bant_authority: quick ? null : bantAuthority,
        bant_need: quick ? null : bantNeed,
        bant_timing: quick ? null : bantTiming,
        data_agendamento: dataAgendamento,
        local: quick ? null : local,
        ...(initialStatus ? { status: initialStatus } : {}),
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
            <div className="flex items-center gap-2">
              <h2 className="text-base font-semibold text-zinc-100">Novo lead</h2>
              {initialStatus && (
                <span className={`flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] font-semibold ${STATUS_COLORS[initialStatus].bg} ${STATUS_COLORS[initialStatus].text} ${STATUS_COLORS[initialStatus].border}`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${STATUS_COLORS[initialStatus].dot}`} />
                  {STATUS_LABELS[initialStatus]}
                </span>
              )}
            </div>
            <p className="text-[11px] text-zinc-500">
              {quick ? "Cadastro rápido · só o nome e o contato do decisor" : "Preencha durante a ligação · ~60s"}
            </p>
          </div>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300" aria-label="Fechar">
            <X size={18} />
          </button>
        </header>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          {/* Aviso de lead duplicado */}
          {duplicate && (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
              <span>
                ⚠️ Esse contato já está em{" "}
                <strong>{duplicate.empresa || duplicate.nome}</strong>.
              </span>
              {onOpenExisting && (
                <button
                  type="button"
                  onClick={() => {
                    onOpenExisting(duplicate);
                    onClose();
                  }}
                  className="rounded-md border border-amber-500/40 bg-amber-500/20 px-2.5 py-1 text-xs font-medium text-amber-100 hover:bg-amber-500/30"
                >
                  Abrir lead existente
                </button>
              )}
            </div>
          )}

          {/* Decisor */}
          <Section title="Decisor">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Nome *">
                <input autoFocus value={nome} onChange={(e) => setNome(e.target.value)} className="ds-input" placeholder="Maria Silva" />
              </Field>
              <Field label="WhatsApp *">
                <input value={telefone} onChange={(e) => setTelefone(e.target.value)} className="ds-input" placeholder="(11) 91234-5678" inputMode="tel" />
              </Field>
            </div>
          </Section>

          {/* Responsáveis */}
          {!quick && (
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
          )}

          {/* Empresa — só de "Qualificado" em diante (na Entrada basta nome + contato) */}
          {!quick && (
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
              <div className="mt-3">
                <Field label="Segmento da confecção">
                  <SegmentoSelect value={segmento} onChange={setSegmento} />
                </Field>
              </div>
              <div className="mt-3">
                <Field label="Estado e cidade *">
                  <EstadoCidadeSelect
                    estado={estado}
                    cidade={cidade}
                    onChange={(v) => { setEstado(v.estado); setCidade(v.cidade); }}
                  />
                </Field>
              </div>
              <div className="mt-3">
                <Field label="Origem (fonte) *">
                  <select
                    value={fonte ?? ""}
                    onChange={(e) => setFonte((e.target.value || null) as LeadFonte | null)}
                    className="w-full rounded-md border border-zinc-800 bg-[#0f1218] px-3 py-2 text-sm text-zinc-100 outline-none focus:border-[#f5c518]"
                  >
                    <option value="">Selecione…</option>
                    {FONTE_OPTIONS.map((f) => (
                      <option key={f} value={f}>{FONTE_LABELS[f]}</option>
                    ))}
                  </select>
                </Field>
              </div>
            </Section>
          )}

          {!quick && (<>
          {/* Qualificação */}
          <Section title="Qualificação *" hint="Toque rápido nas opções">
            <div className="space-y-3">
              <PillRow
                label="Experiência (tempo de mercado)"
                value={experiencia}
                options={Object.entries(EXPERIENCIA_LABELS).map(([v, l]) => ({ value: v as Experiencia, label: l }))}
                onChange={setExperiencia}
              />
              <PillRow
                label="Situação atual"
                value={situacao}
                options={Object.entries(SITUACAO_LABELS).map(([v, l]) => ({ value: v as Situacao, label: l }))}
                onChange={setSituacao}
              />
              <PillRow
                label="Canal de vendas"
                value={canalVendas}
                options={Object.entries(CANAL_VENDAS_LABELS).map(([v, l]) => ({ value: v as CanalVendas, label: l }))}
                onChange={setCanalVendas}
              />
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
                  busyStarts={busyStarts}
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
          </>)}

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
            disabled={saving || !!duplicate}
            className="rounded-md bg-[#f5c518] px-4 py-2 text-sm font-semibold text-zinc-950 hover:bg-[#ffd633] disabled:opacity-50"
          >
            {saving ? "Salvando…" : duplicate ? "Contato já existe" : "Criar lead"}
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

