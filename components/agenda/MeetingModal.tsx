"use client";

import { useMemo, useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Calendar,
  Check,
  Pencil,
  Phone,
  Star,
  Trash2,
  User,
  Video,
  X,
} from "lucide-react";
import { InstagramIcon, WhatsAppIcon } from "@/components/icons/BrandIcons";
import { CargoSelect } from "@/components/ui/CargoSelect";
import { DateTimePicker, busyStartsForDate, joinIso, splitIso } from "@/components/ui/DateTimePicker";
import { LocalSelect } from "@/components/ui/LocalSelect";
import { PersonSelect } from "@/components/ui/PersonSelect";
import { SegmentoSelect } from "@/components/ui/SegmentoSelect";
import { LeadTasks } from "@/components/tasks/LeadTasks";
import { useLeadsContext } from "@/lib/contexts/LeadsContext";
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
  LOCAL_ICONS,
  LOCAL_LABELS,
  SEGMENTO_LABELS,
  SITUACAO_LABELS,
  STATUS_COLORS,
  STATUS_LABELS,
  type Lead,
  type LocalReuniao,
  type SegmentoConfeccao,
  whatsappLink,
} from "@/lib/types";
import { computeLeadScore, PRIORITY_LABELS, PRIORITY_META } from "@/lib/lead-score";

type Props = {
  lead: Lead;
  onClose: () => void;
  onUpdate: (id: string, patch: Partial<Lead>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
};

export function MeetingModal({ lead, onClose, onUpdate, onDelete }: Props) {
  const { leads } = useLeadsContext();
  const [editing, setEditing] = useState(false);
  const initialDateTime = splitIso(lead.data_agendamento);

  // Edit state
  const [nome, setNome] = useState(lead.nome);
  const [telefone, setTelefone] = useState(lead.telefone);
  const [cargo, setCargo] = useState<string | null>(lead.cargo);
  const [empresa, setEmpresa] = useState(lead.empresa ?? "");
  const [instagram, setInstagram] = useState(lead.instagram ?? "");
  const [segmento, setSegmento] = useState<SegmentoConfeccao | null>(lead.segmento);
  const [valor, setValor] = useState(lead.valor != null ? String(lead.valor) : "");
  const [observacoes, setObservacoes] = useState(lead.observacoes ?? "");
  const [sdrResp, setSdrResp] = useState<string | null>(lead.sdr_responsavel);
  const [closerResp, setCloserResp] = useState<string | null>(lead.closer_responsavel);
  const [dateStr, setDateStr] = useState(initialDateTime.date);
  const [timeStr, setTimeStr] = useState(initialDateTime.time);
  const [local, setLocal] = useState<LocalReuniao | null>(lead.local);
  const [meetLink, setMeetLink] = useState(lead.meet_link ?? "");
  const [saving, setSaving] = useState(false);

  const busyStarts = useMemo(
    () => busyStartsForDate(leads, dateStr, lead.id),
    [leads, dateStr, lead.id],
  );

  async function handleSave() {
    setSaving(true);
    try {
      const parsedValor = valor.trim() ? Number(valor.replace(/\./g, "").replace(",", ".")) : null;
      await onUpdate(lead.id, {
        nome: nome.trim(),
        telefone: telefone.trim(),
        cargo,
        empresa: empresa.trim() || null,
        instagram: instagram.trim().replace(/^@/, "") || null,
        segmento,
        valor: parsedValor != null && !Number.isNaN(parsedValor) ? parsedValor : null,
        observacoes: observacoes.trim() || null,
        sdr_responsavel: sdrResp,
        closer_responsavel: closerResp,
        data_agendamento: joinIso(dateStr, timeStr),
        local,
        meet_link: meetLink.trim() || null,
      });
      setEditing(false);
    } finally {
      setSaving(false);
    }
  }

  function cancelEdit() {
    setEditing(false);
    setNome(lead.nome);
    setTelefone(lead.telefone);
    setCargo(lead.cargo);
    setEmpresa(lead.empresa ?? "");
    setInstagram(lead.instagram ?? "");
    setSegmento(lead.segmento);
    setValor(lead.valor != null ? String(lead.valor) : "");
    setObservacoes(lead.observacoes ?? "");
    setSdrResp(lead.sdr_responsavel);
    setCloserResp(lead.closer_responsavel);
    setDateStr(initialDateTime.date);
    setTimeStr(initialDateTime.time);
    setLocal(lead.local);
    setMeetLink(lead.meet_link ?? "");
  }

  async function handleDelete() {
    if (!confirm(`Excluir o lead "${lead.nome}"?`)) return;
    await onDelete(lead.id);
    onClose();
  }

  const colors = STATUS_COLORS[lead.status];

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[92vh] w-full max-w-2xl flex-col rounded-2xl border border-zinc-800 bg-zinc-950 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <header className="flex items-center justify-between gap-3 border-b border-zinc-800 px-5 py-3">
          <div className="flex items-center gap-2 min-w-0">
            <span className={`h-2 w-2 shrink-0 rounded-full ${colors.dot}`} />
            <span className={`text-xs font-semibold uppercase tracking-wide ${colors.text}`}>
              {STATUS_LABELS[lead.status]}
            </span>
            <span className="hidden sm:inline text-zinc-700">·</span>
            <h2 className="hidden sm:block truncate text-sm font-semibold text-zinc-100">
              {lead.empresa || lead.nome}
            </h2>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            {lead.meet_link && !editing && (
              <a
                href={lead.meet_link}
                target="_blank"
                rel="noopener noreferrer"
                className="hidden sm:flex items-center gap-1.5 rounded-md bg-[#1a73e8] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#1557b0]"
                title="Abrir Google Meet"
              >
                <Video size={13} />
                Abrir Meet
              </a>
            )}
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
            {!editing ? (
              <button
                onClick={() => setEditing(true)}
                className="flex items-center gap-1 rounded-md border border-zinc-800 bg-zinc-900 px-2.5 py-1 text-xs text-zinc-300 hover:border-zinc-700 hover:text-zinc-100"
              >
                <Pencil size={12} />
                Editar
              </button>
            ) : (
              <>
                <button
                  onClick={cancelEdit}
                  className="rounded-md px-3 py-1 text-xs text-zinc-400 hover:text-zinc-200"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex items-center gap-1 rounded-md bg-[#f5c518] px-3 py-1 text-xs font-semibold text-zinc-950 hover:bg-[#ffd633] disabled:opacity-50"
                >
                  <Check size={12} />
                  {saving ? "Salvando…" : "Salvar"}
                </button>
              </>
            )}
            <button onClick={handleDelete} className="rounded p-1.5 text-zinc-500 hover:bg-rose-500/10 hover:text-rose-400" aria-label="Excluir">
              <Trash2 size={16} />
            </button>
            <button onClick={onClose} className="rounded p-1.5 text-zinc-500 hover:bg-zinc-900 hover:text-zinc-300" aria-label="Fechar">
              <X size={18} />
            </button>
          </div>
        </header>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {editing ? (
            <EditView
              busyStarts={busyStarts}
              dateStr={dateStr} setDateStr={setDateStr}
              timeStr={timeStr} setTimeStr={setTimeStr}
              local={local} setLocal={setLocal}
              meetLink={meetLink} setMeetLink={setMeetLink}
              nome={nome} setNome={setNome}
              telefone={telefone} setTelefone={setTelefone}
              cargo={cargo} setCargo={setCargo}
              empresa={empresa} setEmpresa={setEmpresa}
              instagram={instagram} setInstagram={setInstagram}
              segmento={segmento} setSegmento={setSegmento}
              sdrResp={sdrResp} setSdrResp={setSdrResp}
              closerResp={closerResp} setCloserResp={setCloserResp}
              valor={valor} setValor={setValor}
              observacoes={observacoes} setObservacoes={setObservacoes}
            />
          ) : (
            <SummaryView lead={lead} />
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Summary (view mode) — leitura limpa pro Closer
// ============================================================
function SummaryView({ lead }: { lead: Lead }) {
  return (
    <div className="space-y-5">
      {/* Agendamento */}
      <div className="rounded-xl border border-[#f5c518]/30 bg-[#f5c518]/5 p-4">
        {lead.data_agendamento ? (
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-[#f5c518]">
            <span className="flex items-center gap-1.5 text-base font-semibold">
              <Calendar size={16} />
              {format(new Date(lead.data_agendamento), "EEEE, d 'de' MMMM", { locale: ptBR })}
            </span>
            <span className="text-sm">
              às {format(new Date(lead.data_agendamento), "HH:mm")}
            </span>
            {lead.local && (
              <span className="rounded bg-[#f5c518]/15 px-2 py-0.5 text-xs font-medium">
                {LOCAL_ICONS[lead.local]} {LOCAL_LABELS[lead.local]}
              </span>
            )}
          </div>
        ) : (
          <div className="text-sm text-zinc-500">Sem data agendada</div>
        )}

        {lead.meet_link && (
          <div className="mt-3 sm:hidden">
            <a
              href={lead.meet_link}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-md bg-[#1a73e8] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#1557b0]"
            >
              <Video size={13} />
              Abrir Meet
            </a>
          </div>
        )}
      </div>

      {/* Qualidade do lead */}
      <QualityBox lead={lead} />

      {/* Decisor + Empresa */}
      <SectionTitle>Decisor</SectionTitle>
      <div className="rounded-lg border border-zinc-900 bg-zinc-950/40 p-3 space-y-1">
        <div className="flex flex-wrap items-baseline gap-2">
          <span className="text-base font-semibold text-zinc-100">{lead.nome}</span>
          {lead.cargo && <span className="text-xs text-zinc-500">· {lead.cargo}</span>}
        </div>
        {lead.empresa && (
          <div className="text-sm text-zinc-300">{lead.empresa}</div>
        )}
        {lead.segmento && (
          <div className="text-xs text-[#f5c518]">👕 {SEGMENTO_LABELS[lead.segmento]}</div>
        )}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-zinc-400">
          <span className="flex items-center gap-1">
            <Phone size={11} />
            {lead.telefone}
          </span>
          {lead.instagram && (
            <span>@{lead.instagram}</span>
          )}
        </div>
      </div>

      {/* Responsáveis */}
      {(lead.sdr_responsavel || lead.closer_responsavel) && (
        <>
          <SectionTitle>Responsáveis</SectionTitle>
          <div className="flex flex-wrap gap-2 text-xs">
            {lead.sdr_responsavel && (
              <span className="flex items-center gap-1.5 rounded bg-sky-500/10 px-2 py-1 text-sky-300">
                <User size={11} />
                SDR · {lead.sdr_responsavel}
              </span>
            )}
            {lead.closer_responsavel && (
              <span className="flex items-center gap-1.5 rounded bg-fuchsia-500/10 px-2 py-1 text-fuchsia-300">
                <User size={11} />
                Closer · {lead.closer_responsavel}
              </span>
            )}
          </div>
        </>
      )}

      {/* Qualificação / BANT */}
      {(lead.experiencia || lead.situacao || lead.canal_vendas ||
        lead.estoque || lead.historico || lead.estrutura ||
        lead.bant_budget || lead.bant_authority || lead.bant_need || lead.bant_timing) && (
        <>
          <SectionTitle>Qualificação · BANT</SectionTitle>
          <div className="flex flex-wrap gap-1.5">
            {lead.experiencia && <Chip>🕒 {EXPERIENCIA_LABELS[lead.experiencia]}</Chip>}
            {lead.situacao && <Chip>👥 {SITUACAO_LABELS[lead.situacao]}</Chip>}
            {lead.canal_vendas && <Chip>🛒 {CANAL_VENDAS_LABELS[lead.canal_vendas]}</Chip>}
            {lead.estoque && <Chip>📦 {ESTOQUE_LABELS[lead.estoque]}</Chip>}
            {lead.historico && <Chip>📈 {HISTORICO_LABELS[lead.historico]}</Chip>}
            {lead.estrutura && <Chip>👥 {ESTRUTURA_LABELS[lead.estrutura]}</Chip>}
            {lead.bant_budget && <Chip>💰 {BANT_BUDGET_LABELS[lead.bant_budget]}</Chip>}
            {lead.bant_authority && <Chip>🎯 {BANT_AUTHORITY_LABELS[lead.bant_authority]}</Chip>}
            {lead.bant_need && <Chip>🔥 {BANT_NEED_LABELS[lead.bant_need]}</Chip>}
            {lead.bant_timing && <Chip>⏱ {BANT_TIMING_LABELS[lead.bant_timing]}</Chip>}
          </div>
        </>
      )}

      {/* Valor */}
      {lead.valor != null && (
        <>
          <SectionTitle>Valor estimado</SectionTitle>
          <div className="text-lg font-semibold text-emerald-300">
            {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(lead.valor))}
          </div>
        </>
      )}

      {/* Observações */}
      {lead.observacoes && (
        <>
          <SectionTitle>Observações</SectionTitle>
          <div className="whitespace-pre-wrap rounded-lg border border-zinc-900 bg-zinc-950/40 p-3 text-sm text-zinc-300">
            {lead.observacoes}
          </div>
        </>
      )}

      {/* Tarefas */}
      <LeadTasks lead={lead} />
    </div>
  );
}

// ============================================================
// Edit (form)
// ============================================================
type EditProps = {
  busyStarts: number[];
  dateStr: string; setDateStr: (v: string) => void;
  timeStr: string; setTimeStr: (v: string) => void;
  local: LocalReuniao | null; setLocal: (v: LocalReuniao | null) => void;
  meetLink: string; setMeetLink: (v: string) => void;
  nome: string; setNome: (v: string) => void;
  telefone: string; setTelefone: (v: string) => void;
  cargo: string | null; setCargo: (v: string | null) => void;
  empresa: string; setEmpresa: (v: string) => void;
  instagram: string; setInstagram: (v: string) => void;
  segmento: SegmentoConfeccao | null; setSegmento: (v: SegmentoConfeccao | null) => void;
  sdrResp: string | null; setSdrResp: (v: string | null) => void;
  closerResp: string | null; setCloserResp: (v: string | null) => void;
  valor: string; setValor: (v: string) => void;
  observacoes: string; setObservacoes: (v: string) => void;
};

function EditView(props: EditProps) {
  return (
    <div className="space-y-5">
      <Section title="Agendamento">
        <DateTimePicker
          date={props.dateStr}
          time={props.timeStr}
          onDateChange={props.setDateStr}
          onTimeChange={props.setTimeStr}
          busyStarts={props.busyStarts}
          showClear
        />
        <Field label="Local">
          <LocalSelect value={props.local} onChange={props.setLocal} />
        </Field>
        <Field label="Link do Google Meet">
          <div className="flex items-center rounded-md border border-zinc-800 bg-[#0f1218] focus-within:border-[#1a73e8]/60">
            <Video size={14} className="ml-3 text-[#1a73e8]" />
            <input
              value={props.meetLink}
              onChange={(e) => props.setMeetLink(e.target.value)}
              className="flex-1 bg-transparent px-2 py-2 text-sm text-zinc-100 outline-none"
              placeholder="https://meet.google.com/abc-defg-hij"
            />
          </div>
        </Field>
      </Section>

      <Section title="Decisor & Empresa">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Nome">
            <input value={props.nome} onChange={(e) => props.setNome(e.target.value)} className="ds-input2" />
          </Field>
          <Field label="WhatsApp">
            <input value={props.telefone} onChange={(e) => props.setTelefone(e.target.value)} className="ds-input2" inputMode="tel" />
          </Field>
        </div>
        <Field label="Cargo">
          <CargoSelect value={props.cargo} onChange={props.setCargo} />
        </Field>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Empresa">
            <input value={props.empresa} onChange={(e) => props.setEmpresa(e.target.value)} className="ds-input2" />
          </Field>
          <Field label="Instagram">
            <div className="flex items-center rounded-md border border-zinc-800 bg-[#0f1218] focus-within:border-[#f5c518]">
              <span className="pl-3 text-sm text-zinc-500">@</span>
              <input
                value={props.instagram}
                onChange={(e) => props.setInstagram(e.target.value.replace(/^@/, ""))}
                className="flex-1 bg-transparent px-2 py-2 text-sm text-zinc-100 outline-none"
              />
            </div>
          </Field>
        </div>
        <Field label="Segmento da confecção">
          <SegmentoSelect value={props.segmento} onChange={props.setSegmento} />
        </Field>
      </Section>

      <Section title="Responsáveis">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="SDR responsável">
            <PersonSelect role="SDR" value={props.sdrResp} onChange={props.setSdrResp} />
          </Field>
          <Field label="Closer responsável">
            <PersonSelect role="Closer" value={props.closerResp} onChange={props.setCloserResp} />
          </Field>
        </div>
      </Section>

      <Section title="Valor estimado">
        <input value={props.valor} onChange={(e) => props.setValor(e.target.value)} className="ds-input2" placeholder="R$ 0,00" inputMode="decimal" />
      </Section>

      <Section title="Observações">
        <textarea
          value={props.observacoes}
          onChange={(e) => props.setObservacoes(e.target.value)}
          rows={4}
          className="ds-input2 resize-y"
          placeholder="Notas sobre o lead, contexto da reunião, próximos passos…"
        />
      </Section>

      <style jsx>{`
        .ds-input2 {
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
        .ds-input2:focus { border-color: #f5c518; }
      `}</style>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <SectionTitle>{title}</SectionTitle>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
      {children}
    </h3>
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

// ============================================================
// Box de qualidade do lead — resumo pro Closer antes da reunião
// ============================================================
function QualityBox({ lead }: { lead: Lead }) {
  const { stars, priority, score, answered, total } = computeLeadScore(lead);
  const prio = PRIORITY_META[priority];

  // Resumo curto: 2-3 sinais que mais pesam
  const resumo: string[] = [];
  if (lead.bant_budget === "tem_verba") resumo.push("tem verba");
  else if (lead.bant_budget === "nao_tem") resumo.push("sem verba agora");
  if (lead.bant_authority === "decisor") resumo.push("fala com o decisor");
  else if (lead.bant_authority === "precisa_aprovar") resumo.push("precisa aprovar com outro");
  if (lead.bant_timing === "agora") resumo.push("quer começar já");
  else if (lead.bant_timing === "sem_urgencia") resumo.push("sem urgência");
  if (lead.situacao === "com_com_demanda") resumo.push("tem clientes e demanda");
  else if (lead.situacao === "sem_clientes") resumo.push("ainda sem clientes");

  return (
    <div className={`rounded-xl border p-4 ${prio.bg} ${prio.border}`}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
            Qualidade do lead
          </div>
          <StarRating stars={stars} />
        </div>
        <div className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${prio.text}`}>
          <span>{prio.emoji}</span>
          {PRIORITY_LABELS[priority]}
        </div>
      </div>
      {resumo.length > 0 && (
        <p className="mt-2 text-sm text-zinc-300">
          {resumo.join(" · ")}.
        </p>
      )}
      <div className="mt-2 text-[11px] text-zinc-500">
        Score {score}/100 · baseado em {answered} de {total} respostas
      </div>
    </div>
  );
}

function StarRating({ stars }: { stars: number }) {
  return (
    <div className="mt-1 flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          size={18}
          className={n <= stars ? "fill-[#f5c518] text-[#f5c518]" : "fill-zinc-800 text-zinc-700"}
        />
      ))}
      <span className="ml-1.5 text-sm font-semibold text-zinc-200">{stars}/5</span>
    </div>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded bg-zinc-900 px-2 py-1 text-[11px] text-zinc-200">
      {children}
    </span>
  );
}

