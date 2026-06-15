"use client";

import { useMemo, useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ArrowRight, Calendar, Check, Lock, Pencil, Trash2, X } from "lucide-react";
import { InstagramIcon, WhatsAppIcon } from "@/components/icons/BrandIcons";
import { CargoSelect } from "@/components/ui/CargoSelect";
import { DateTimePicker, busyStartsForDate, joinIso, splitIso } from "@/components/ui/DateTimePicker";
import { LocalSelect } from "@/components/ui/LocalSelect";
import { PersonSelect } from "@/components/ui/PersonSelect";
import { SegmentoSelect } from "@/components/ui/SegmentoSelect";
import { LeadTasks } from "@/components/tasks/LeadTasks";
import { CreativeCodePicker, formatCreativeCode } from "@/components/lead/CreativeCodeDialog";
import { useLeadEvents } from "@/lib/hooks/useLeads";
import { useLeadsContext } from "@/lib/contexts/LeadsContext";
import { useTeamContext } from "@/lib/contexts/TeamContext";
import {
  canMoveTo,
  BANT_AUTHORITY_LABELS,
  BANT_BUDGET_LABELS,
  BANT_NEED_LABELS,
  BANT_TIMING_LABELS,
  ESTOQUE_LABELS,
  ESTRUTURA_LABELS,
  HISTORICO_LABELS,
  LOCAL_ICONS,
  LOCAL_LABELS,
  STATUS_COLORS,
  STATUS_LABELS,
  STATUS_ORDER,
  type BantAuthority,
  type BantBudget,
  type BantNeed,
  type BantTiming,
  type EstoqueNivel,
  type EstruturaComercial,
  type HistoricoTrafego,
  type Lead,
  type LeadStatus,
  type LocalReuniao,
  type Owner,
  type SegmentoConfeccao,
  whatsappLink,
} from "@/lib/types";

type Props = {
  lead: Lead;
  onClose: () => void;
  onUpdate: (id: string, patch: Partial<Lead>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
};

export function LeadDetailsPanel({ lead, onClose, onUpdate, onDelete }: Props) {
  const { leads } = useLeadsContext();
  const { isAdmin, currentMember } = useTeamContext();
  const viewerRole: Owner | null =
    isAdmin || currentMember?.role === "Trafego" ? null : currentMember?.role ?? null;
  const initialDateTime = splitIso(lead.data_agendamento);

  const [nome, setNome] = useState(lead.nome);
  const [telefone, setTelefone] = useState(lead.telefone);
  const [cargo, setCargo] = useState<string | null>(lead.cargo);
  const [empresa, setEmpresa] = useState(lead.empresa ?? "");
  const [instagram, setInstagram] = useState(lead.instagram ?? "");
  const [segmento, setSegmento] = useState<SegmentoConfeccao | null>(lead.segmento);
  const [dono, setDono] = useState<Owner>(lead.dono);
  const [valor, setValor] = useState(lead.valor != null ? String(lead.valor) : "");
  const [observacoes, setObservacoes] = useState(lead.observacoes ?? "");
  const [sdrResp, setSdrResp] = useState<string | null>(lead.sdr_responsavel);
  const [closerResp, setCloserResp] = useState<string | null>(lead.closer_responsavel);
  const [editCreative, setEditCreative] = useState(false);
  const [dateStr, setDateStr] = useState(initialDateTime.date);
  const [timeStr, setTimeStr] = useState(initialDateTime.time);
  const [local, setLocal] = useState<LocalReuniao | null>(lead.local);

  const busyStarts = useMemo(
    () => busyStartsForDate(leads, dateStr, lead.id),
    [leads, dateStr, lead.id],
  );

  // Qualificação + BANT (editáveis via card "Resumo pré-reunião")
  const [estoque, setEstoque] = useState<EstoqueNivel | null>(lead.estoque);
  const [historico, setHistorico] = useState<HistoricoTrafego | null>(lead.historico);
  const [estrutura, setEstrutura] = useState<EstruturaComercial | null>(lead.estrutura);
  const [bantBudget, setBantBudget] = useState<BantBudget | null>(lead.bant_budget);
  const [bantAuthority, setBantAuthority] = useState<BantAuthority | null>(lead.bant_authority);
  const [bantNeed, setBantNeed] = useState<BantNeed | null>(lead.bant_need);
  const [bantTiming, setBantTiming] = useState<BantTiming | null>(lead.bant_timing);

  const [editingQual, setEditingQual] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);

  const { events } = useLeadEvents(lead.id);

  async function handleStatusChange(newStatus: LeadStatus) {
    await onUpdate(lead.id, { status: newStatus });
  }

  async function handleSave() {
    setSaving(true);
    try {
      const parsedValor = valor.trim() ? Number(valor.replace(/\./g, "").replace(",", ".")) : null;
      await onUpdate(lead.id, {
        nome: nome.trim(),
        telefone: telefone.trim(),
        cargo: cargo,
        empresa: empresa.trim() || null,
        instagram: instagram.trim().replace(/^@/, "") || null,
        segmento,
        dono,
        valor: parsedValor != null && !Number.isNaN(parsedValor) ? parsedValor : null,
        observacoes: observacoes.trim() || null,
        sdr_responsavel: sdrResp,
        closer_responsavel: closerResp,
        data_agendamento: joinIso(dateStr, timeStr),
        local,
        estoque,
        historico,
        estrutura,
        bant_budget: bantBudget,
        bant_authority: bantAuthority,
        bant_need: bantNeed,
        bant_timing: bantTiming,
      });
      setDirty(false);
      setEditingQual(false);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!confirm(`Excluir o lead "${lead.nome}"?`)) return;
    await onDelete(lead.id);
    onClose();
  }

  function markDirty<T>(setter: (v: T) => void) {
    return (v: T) => {
      setter(v);
      setDirty(true);
    };
  }

  const colors = STATUS_COLORS[lead.status];

  return (
    <div className="fixed inset-0 z-40 flex" onClick={onClose}>
      <div className="flex-1 bg-black/60 backdrop-blur-sm" />
      <aside
        onClick={(e) => e.stopPropagation()}
        className="flex h-full w-full max-w-md flex-col border-l border-zinc-800 bg-zinc-950 shadow-2xl sm:w-[480px]"
      >
        <header className="flex items-center justify-between border-b border-zinc-800 px-5 py-3">
          <div className="flex items-center gap-2">
            <span className={`h-2 w-2 rounded-full ${colors.dot}`} />
            <span className={`text-xs font-semibold uppercase tracking-wide ${colors.text}`}>
              {STATUS_LABELS[lead.status]}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <a
              href={whatsappLink(lead.telefone)}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded p-1.5 text-[#25D366] hover:bg-[#25D366]/10"
              title="WhatsApp"
            >
              <WhatsAppIcon size={16} />
            </a>
            {lead.instagram && (
              <a
                href={`https://instagram.com/${lead.instagram}`}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded p-1.5 text-[#E1306C] hover:bg-[#E1306C]/10"
                title={`@${lead.instagram}`}
              >
                <InstagramIcon size={16} />
              </a>
            )}
            <button onClick={handleDelete} className="rounded p-1.5 text-zinc-500 hover:bg-rose-500/10 hover:text-rose-400" aria-label="Excluir">
              <Trash2 size={16} />
            </button>
            <button onClick={onClose} className="rounded p-1.5 text-zinc-500 hover:bg-zinc-900 hover:text-zinc-300" aria-label="Fechar">
              <X size={18} />
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          {/* Resumo pré-reunião (editável) */}
          <PreReuniaoCard
            editing={editingQual}
            onToggleEdit={() => setEditingQual((v) => !v)}
            dataAgendamentoIso={joinIso(dateStr, timeStr)}
            local={local}
            estoque={estoque}      onEstoque={markDirty(setEstoque)}
            historico={historico}  onHistorico={markDirty(setHistorico)}
            estrutura={estrutura}  onEstrutura={markDirty(setEstrutura)}
            bantBudget={bantBudget}        onBantBudget={markDirty(setBantBudget)}
            bantAuthority={bantAuthority}  onBantAuthority={markDirty(setBantAuthority)}
            bantNeed={bantNeed}            onBantNeed={markDirty(setBantNeed)}
            bantTiming={bantTiming}        onBantTiming={markDirty(setBantTiming)}
          />

          {/* Decisor + Empresa */}
          <Section title="Decisor & Empresa">
            <Field label="Nome">
              <input value={nome} onChange={(e) => { setNome(e.target.value); setDirty(true); }} className="ds-input" />
            </Field>
            <Field label="WhatsApp">
              <input value={telefone} onChange={(e) => { setTelefone(e.target.value); setDirty(true); }} className="ds-input" inputMode="tel" />
            </Field>
            <Field label="Cargo">
              <CargoSelect value={cargo} onChange={(v) => { setCargo(v); setDirty(true); }} />
            </Field>
            <Field label="Empresa">
              <input value={empresa} onChange={(e) => { setEmpresa(e.target.value); setDirty(true); }} className="ds-input" />
            </Field>
            <Field label="Instagram">
              <div className="flex items-center rounded-md border border-zinc-800 bg-[#0f1218] focus-within:border-[#f5c518]">
                <span className="pl-3 text-sm text-zinc-500">@</span>
                <input
                  value={instagram}
                  onChange={(e) => { setInstagram(e.target.value.replace(/^@/, "")); setDirty(true); }}
                  className="flex-1 bg-transparent px-2 py-2 text-sm text-zinc-100 outline-none"
                />
              </div>
            </Field>
            <Field label="Segmento da confecção">
              <SegmentoSelect value={segmento} onChange={(v) => { setSegmento(v); setDirty(true); }} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Dono">
                <div className="flex gap-1.5">
                  {(["SDR", "Closer"] as Owner[]).map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => { setDono(opt); setDirty(true); }}
                      className={`flex-1 rounded-md border px-2 py-1.5 text-xs transition-colors ${
                        dono === opt
                          ? opt === "SDR"
                            ? "border-sky-500/50 bg-sky-500/15 text-sky-200"
                            : "border-fuchsia-500/50 bg-fuchsia-500/15 text-fuchsia-200"
                          : "border-zinc-800 bg-zinc-900 text-zinc-400"
                      }`}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </Field>
              <Field label="Valor">
                <input value={valor} onChange={(e) => { setValor(e.target.value); setDirty(true); }} className="ds-input" placeholder="R$ 0,00" inputMode="decimal" />
              </Field>
            </div>
          </Section>

          {/* Responsáveis */}
          <Section title="Responsáveis">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="SDR responsável">
                <PersonSelect
                  role="SDR"
                  value={sdrResp}
                  onChange={(v) => { setSdrResp(v); setDirty(true); }}
                />
              </Field>
              <Field label="Closer responsável">
                <PersonSelect
                  role="Closer"
                  value={closerResp}
                  onChange={(v) => { setCloserResp(v); setDirty(true); }}
                />
              </Field>
            </div>
          </Section>

          {/* Agendamento */}
          <Section title="Agendamento da reunião">
            <DateTimePicker
              date={dateStr}
              time={timeStr}
              onDateChange={(v) => { setDateStr(v); setDirty(true); }}
              onTimeChange={(v) => { setTimeStr(v); setDirty(true); }}
              busyStarts={busyStarts}
              showClear
            />
            <Field label="Local">
              <LocalSelect value={local} onChange={(v) => { setLocal(v); setDirty(true); }} />
            </Field>
          </Section>

          {/* Tarefas */}
          <LeadTasks lead={lead} />

          {/* Status selector */}
          <Section title="Mover para">
            <div className="grid grid-cols-2 gap-1.5">
              {STATUS_ORDER.map((s) => {
                const c = STATUS_COLORS[s];
                const active = s === lead.status;
                const locked = !active && !canMoveTo(s, { role: viewerRole, isAdmin });
                return (
                  <button
                    key={s}
                    onClick={() => handleStatusChange(s)}
                    disabled={active || locked}
                    title={locked ? "Etapa do Closer — só o Closer move pra cá" : undefined}
                    className={`flex items-center gap-1.5 rounded-md border px-2 py-1.5 text-left text-xs transition-colors ${
                      active
                        ? `${c.bg} ${c.border} ${c.text} cursor-default`
                        : locked
                          ? "cursor-not-allowed border-zinc-900 bg-black/40 text-zinc-600"
                          : "border-zinc-800 bg-zinc-900 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200"
                    }`}
                  >
                    {locked ? (
                      <Lock size={11} className="shrink-0 text-zinc-700" />
                    ) : (
                      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${c.dot}`} />
                    )}
                    <span className="truncate">{STATUS_LABELS[s]}</span>
                  </button>
                );
              })}
            </div>
          </Section>

          {/* Observações */}
          <Field label="Observações">
            <textarea
              value={observacoes}
              onChange={(e) => { setObservacoes(e.target.value); setDirty(true); }}
              rows={4}
              className="ds-input resize-y"
              placeholder="Notas sobre o lead, contexto da reunião, próximos passos…"
            />
          </Field>

          {dirty && (
            <button
              onClick={handleSave}
              disabled={saving}
              className="w-full rounded-md bg-[#f5c518] px-3 py-2 text-sm font-semibold text-zinc-950 hover:bg-[#ffd633] disabled:opacity-50"
            >
              {saving ? "Salvando…" : "Salvar alterações"}
            </button>
          )}

          {/* Datas-chave + rastreio de criativo */}
          <Section title="Datas e rastreio">
            <dl className="space-y-1.5 text-xs">
              <DateRow label="Entrou no funil" iso={lead.created_at} hint="automático" />
              <EditableDateRow
                label="Reunião realizada"
                iso={lead.reuniao_realizada_em}
                onSave={(v) => onUpdate(lead.id, { reuniao_realizada_em: v })}
              />
              <EditableDateRow
                label="Negócio ganho"
                iso={lead.ganho_em}
                accent
                onSave={(v) => onUpdate(lead.id, { ganho_em: v })}
              />

              <div className="flex items-start justify-between gap-2 pt-1">
                <dt className="pt-1 text-zinc-500">Código do criativo</dt>
                <dd className="flex-1 text-right">
                  {editCreative ? (
                    <div className="text-left">
                      <CreativeCodePicker
                        value={lead.criativo_codigo}
                        onChange={async (n) => {
                          await onUpdate(lead.id, { criativo_codigo: n });
                          setEditCreative(false);
                        }}
                      />
                      <button
                        onClick={() => setEditCreative(false)}
                        className="mt-2 text-[11px] text-zinc-500 hover:text-zinc-300"
                      >
                        Cancelar
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setEditCreative(true)}
                      className="inline-flex items-center gap-1.5 rounded-md border border-zinc-800 bg-zinc-900 px-2 py-1 text-zinc-300 hover:border-zinc-700"
                    >
                      <span className="font-semibold tabular-nums">
                        {formatCreativeCode(lead.criativo_codigo)}
                      </span>
                      <Pencil size={10} className="text-zinc-500" />
                    </button>
                  )}
                </dd>
              </div>
            </dl>
          </Section>

          {/* Timeline */}
          <Section title="Histórico">
            <ul className="space-y-2">
              {events.length === 0 && <li className="text-xs text-zinc-600">Sem eventos.</li>}
              {events.map((ev) => (
                <li key={ev.id} className="rounded-md border border-zinc-800/70 bg-zinc-900/40 p-2.5">
                  <div className="flex items-center gap-1.5 text-[11px] text-zinc-500">
                    <Calendar size={11} />
                    {format(new Date(ev.created_at), "d 'de' MMM 'às' HH:mm", { locale: ptBR })}
                  </div>
                  <div className="mt-1 text-xs text-zinc-200">
                    {ev.tipo === "created" && (
                      <span>Lead criado em <strong>{STATUS_LABELS[ev.to_status!]}</strong></span>
                    )}
                    {ev.tipo === "status_change" && (
                      <span className="flex items-center gap-1.5 flex-wrap">
                        <span className={STATUS_COLORS[ev.from_status!].text}>{STATUS_LABELS[ev.from_status!]}</span>
                        <ArrowRight size={12} className="text-zinc-500" />
                        <span className={STATUS_COLORS[ev.to_status!].text}>{STATUS_LABELS[ev.to_status!]}</span>
                      </span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </Section>
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
      </aside>
    </div>
  );
}

// ============================================================
// Pre-Reunião Card — modo visualização (chips) ou edição (pills)
// ============================================================

type PreReuniaoProps = {
  editing: boolean;
  onToggleEdit: () => void;
  dataAgendamentoIso: string | null;
  local: LocalReuniao | null;
  estoque: EstoqueNivel | null;       onEstoque: (v: EstoqueNivel | null) => void;
  historico: HistoricoTrafego | null;  onHistorico: (v: HistoricoTrafego | null) => void;
  estrutura: EstruturaComercial | null; onEstrutura: (v: EstruturaComercial | null) => void;
  bantBudget: BantBudget | null;        onBantBudget: (v: BantBudget | null) => void;
  bantAuthority: BantAuthority | null;  onBantAuthority: (v: BantAuthority | null) => void;
  bantNeed: BantNeed | null;            onBantNeed: (v: BantNeed | null) => void;
  bantTiming: BantTiming | null;        onBantTiming: (v: BantTiming | null) => void;
};

function PreReuniaoCard(props: PreReuniaoProps) {
  const {
    editing, onToggleEdit, dataAgendamentoIso, local,
    estoque, onEstoque, historico, onHistorico, estrutura, onEstrutura,
    bantBudget, onBantBudget, bantAuthority, onBantAuthority,
    bantNeed, onBantNeed, bantTiming, onBantTiming,
  } = props;

  const hasAny =
    estoque || historico || estrutura ||
    bantBudget || bantAuthority || bantNeed || bantTiming ||
    dataAgendamentoIso || local;

  return (
    <div className="rounded-lg border border-[#f5c518]/20 bg-[#f5c518]/5 p-3">
      <div className="mb-2 flex items-center justify-between">
        <div className="text-[10px] font-semibold uppercase tracking-wider text-[#f5c518]">
          Resumo pré-reunião
        </div>
        <button
          onClick={onToggleEdit}
          className="flex items-center gap-1 rounded p-1 text-[10px] text-[#f5c518]/80 hover:bg-[#f5c518]/10 hover:text-[#f5c518]"
          aria-label={editing ? "Concluir edição" : "Editar BANT"}
        >
          {editing ? (
            <>
              <Check size={11} />
              <span>Concluir</span>
            </>
          ) : (
            <>
              <Pencil size={10} />
              <span>Editar</span>
            </>
          )}
        </button>
      </div>

      {dataAgendamentoIso && (
        <div className="mb-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm font-medium text-[#f5c518]">
          <span className="flex items-center gap-1.5">
            <Calendar size={14} />
            {format(new Date(dataAgendamentoIso), "EEEE, d 'de' MMM 'às' HH:mm", { locale: ptBR })}
          </span>
          {local && (
            <span className="rounded bg-[#f5c518]/15 px-1.5 py-0.5 text-[11px]">
              {LOCAL_ICONS[local]} {LOCAL_LABELS[local]}
            </span>
          )}
        </div>
      )}

      {!editing && !hasAny && (
        <div className="text-xs text-zinc-500">
          Sem qualificação BANT preenchida. Clique em <strong>Editar</strong> pra preencher.
        </div>
      )}

      {!editing && hasAny && (
        <div className="flex flex-wrap gap-1.5">
          {estoque && <Chip>📦 {ESTOQUE_LABELS[estoque]}</Chip>}
          {historico && <Chip>📈 {HISTORICO_LABELS[historico]}</Chip>}
          {estrutura && <Chip>👥 {ESTRUTURA_LABELS[estrutura]}</Chip>}
          {bantBudget && <Chip>💰 {BANT_BUDGET_LABELS[bantBudget]}</Chip>}
          {bantAuthority && <Chip>🎯 {BANT_AUTHORITY_LABELS[bantAuthority]}</Chip>}
          {bantNeed && <Chip>🔥 {BANT_NEED_LABELS[bantNeed]}</Chip>}
          {bantTiming && <Chip>⏱ {BANT_TIMING_LABELS[bantTiming]}</Chip>}
        </div>
      )}

      {editing && (
        <div className="space-y-3">
          <PillRow
            label="📦 Estoque"
            value={estoque}
            options={Object.entries(ESTOQUE_LABELS).map(([v, l]) => ({ value: v as EstoqueNivel, label: l }))}
            onChange={onEstoque}
          />
          <PillRow
            label="📈 Histórico de tráfego"
            value={historico}
            options={Object.entries(HISTORICO_LABELS).map(([v, l]) => ({ value: v as HistoricoTrafego, label: l }))}
            onChange={onHistorico}
          />
          <PillRow
            label="👥 Estrutura comercial"
            value={estrutura}
            options={Object.entries(ESTRUTURA_LABELS).map(([v, l]) => ({ value: v as EstruturaComercial, label: l }))}
            onChange={onEstrutura}
          />
          <div className="mt-2 mb-1 text-[10px] font-semibold uppercase tracking-wider text-[#f5c518]/80">
            BANT
          </div>
          <PillRow
            label="💰 Budget"
            value={bantBudget}
            options={Object.entries(BANT_BUDGET_LABELS).map(([v, l]) => ({ value: v as BantBudget, label: l }))}
            onChange={onBantBudget}
          />
          <PillRow
            label="🎯 Authority"
            value={bantAuthority}
            options={Object.entries(BANT_AUTHORITY_LABELS).map(([v, l]) => ({ value: v as BantAuthority, label: l }))}
            onChange={onBantAuthority}
          />
          <PillRow
            label="🔥 Need"
            value={bantNeed}
            options={Object.entries(BANT_NEED_LABELS).map(([v, l]) => ({ value: v as BantNeed, label: l }))}
            onChange={onBantNeed}
          />
          <PillRow
            label="⏱ Timing"
            value={bantTiming}
            options={Object.entries(BANT_TIMING_LABELS).map(([v, l]) => ({ value: v as BantTiming, label: l }))}
            onChange={onBantTiming}
          />
          <p className="mt-1 text-[10px] text-zinc-500">
            Lembre de clicar em <strong>Salvar alterações</strong> no fim do painel.
          </p>
        </div>
      )}
    </div>
  );
}

function PillRow<T extends string>({
  label, value, options, onChange,
}: {
  label: string;
  value: T | null;
  options: { value: T; label: string }[];
  onChange: (v: T | null) => void;
}) {
  return (
    <div>
      <div className="mb-1 text-[11px] font-medium text-zinc-300">{label}</div>
      <div className="flex flex-wrap gap-1">
        {options.map((opt) => {
          const selected = opt.value === value;
          return (
            <button
              key={String(opt.value)}
              type="button"
              onClick={() => onChange(selected ? null : opt.value)}
              className={`rounded border px-2 py-1 text-[11px] transition-colors ${
                selected
                  ? "border-[#f5c518]/50 bg-[#f5c518]/15 text-[#f5c518]"
                  : "border-zinc-800 bg-zinc-900/70 text-zinc-400 hover:border-zinc-700"
              }`}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded bg-zinc-900/70 px-2 py-1 text-[11px] text-zinc-200">
      {children}
    </span>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">{title}</h3>
      <div className="space-y-3">{children}</div>
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

function DateRow({ label, iso, accent, hint }: { label: string; iso: string; accent?: boolean; hint?: string }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <dt className="text-zinc-500">
        {label}
        {hint && <span className="ml-1 text-[10px] text-zinc-600">· {hint}</span>}
      </dt>
      <dd className={`flex items-center gap-1.5 font-medium ${accent ? "text-emerald-300" : "text-zinc-300"}`}>
        <Calendar size={11} className="text-zinc-500" />
        {format(new Date(iso), "d 'de' MMM yyyy 'às' HH:mm", { locale: ptBR })}
      </dd>
    </div>
  );
}

// Data de rastreio editável manualmente (reunião realizada / negócio ganho).
function EditableDateRow({
  label, iso, accent, onSave,
}: {
  label: string;
  iso: string | null;
  accent?: boolean;
  onSave: (iso: string | null) => Promise<void>;
}) {
  const init = (() => {
    if (!iso) return "";
    const s = splitIso(iso);
    return s.date && s.time ? `${s.date}T${s.time}` : "";
  })();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(init);
  const [saving, setSaving] = useState(false);

  async function save(value: string | null) {
    setSaving(true);
    try {
      await onSave(value);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  }

  if (editing) {
    return (
      <div className="flex flex-col gap-1.5 rounded-md border border-zinc-800/70 bg-zinc-900/40 p-2">
        <span className="text-zinc-500">{label}</span>
        <input
          type="datetime-local"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          className="rounded border border-zinc-800 bg-[#0f1218] px-2 py-1 text-xs text-zinc-100 outline-none focus:border-[#f5c518] [color-scheme:dark]"
        />
        <div className="flex items-center gap-2">
          <button
            onClick={() => save(draft ? new Date(draft).toISOString() : null)}
            disabled={saving}
            className="rounded bg-[#f5c518] px-2.5 py-1 text-[11px] font-semibold text-zinc-950 hover:bg-[#ffd633] disabled:opacity-50"
          >
            {saving ? "…" : "Salvar"}
          </button>
          {iso && (
            <button onClick={() => save(null)} disabled={saving} className="text-[11px] text-zinc-500 hover:text-rose-400">
              Limpar
            </button>
          )}
          <button onClick={() => { setDraft(init); setEditing(false); }} className="text-[11px] text-zinc-500 hover:text-zinc-300">
            Cancelar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between gap-2">
      <dt className="text-zinc-500">{label}</dt>
      <dd className="flex items-center gap-1.5">
        {iso ? (
          <span className={`flex items-center gap-1.5 font-medium ${accent ? "text-emerald-300" : "text-zinc-300"}`}>
            <Calendar size={11} className="text-zinc-500" />
            {format(new Date(iso), "d 'de' MMM yyyy 'às' HH:mm", { locale: ptBR })}
          </span>
        ) : (
          <span className="text-zinc-600">—</span>
        )}
        <button
          onClick={() => { setDraft(init); setEditing(true); }}
          className="text-zinc-600 hover:text-zinc-300"
          aria-label={`Editar ${label}`}
        >
          <Pencil size={10} />
        </button>
      </dd>
    </div>
  );
}
