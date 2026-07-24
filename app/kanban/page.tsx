"use client";

import { Suspense, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CalendarDays, ChevronDown, X } from "lucide-react";
import { Board } from "@/components/kanban/Board";
import { LeadSearch } from "@/components/kanban/LeadSearch";
import { TopBar } from "@/components/layout/TopBar";
import { CloserSelectDialog } from "@/components/lead/CloserSelectDialog";
import { CarteiraReasonDialog } from "@/components/lead/CarteiraReasonDialog";
import { CompletePreQualDialog } from "@/components/lead/CompletePreQualDialog";
import { NewTaskDialog } from "@/components/tasks/NewTaskDialog";
import { CompleteQualificationDialog } from "@/components/lead/CompleteQualificationDialog";
import { CreativeCodeDialog } from "@/components/lead/CreativeCodeDialog";
import { DisqualifyDialog } from "@/components/lead/DisqualifyDialog";
import { LeadDetailsPanel } from "@/components/lead/LeadDetailsPanel";
import { LostReasonDialog } from "@/components/lead/LostReasonDialog";
import { NewLeadDialog } from "@/components/lead/NewLeadDialog";
import { Celebration, type CelebrationKind } from "@/components/ui/Celebration";
import { useLeadsContext } from "@/lib/contexts/LeadsContext";
import { useTeamContext } from "@/lib/contexts/TeamContext";
import { useStickyState } from "@/lib/hooks/useStickyState";
import { resolveRange, type PeriodPreset } from "@/lib/reports";
import { FONTE_LABELS, FONTE_OPTIONS, PRODUTO_LABELS, PRODUTO_OPTIONS, SEGMENTO_LABELS, type Lead, type LeadFonte, type LeadProduto, type LeadStatus, type LocalReuniao, type MotivoCarteira, type MotivoDesqualificacao, type MotivoPerda, type SegmentoConfeccao } from "@/lib/types";
import { computeLeadScore, PRIORITY_SHORT, type LeadPriority } from "@/lib/lead-score";

// Info do negócio (empresa, instagram, decisor, segmento) — obrigatória de
// "Pré qualificado" em diante. Entrada e as saídas (perdido/sem resposta/
// desqualificado) não exigem.
// Carteira fica de fora de propósito: é o "estacionamento" (lead que não está
// pronto agora) — não exige qualificação, mas pede motivo + tarefa de recontato.
const BUSINESS_STAGES: LeadStatus[] = [
  "pre_qualificado", "em_agendamento", "agendando", "reuniao_agendada", "no_show", "follow_up", "negocio_ganho",
];
// Qualificação + BANT — obrigatória de "Qualificado" (em_agendamento) em diante.
const QUAL_STAGES: LeadStatus[] = [
  "em_agendamento", "agendando", "reuniao_agendada", "no_show", "follow_up", "negocio_ganho",
];

// Pré qualificado: dados do negócio preenchidos (inclui localização + fonte).
function isPreQualComplete(l: Lead): boolean {
  return !!(l.nome && l.empresa && l.instagram && l.segmento && l.cidade && l.estado && l.fonte);
}

// Qualificado+: produto + qualificação + BANT completos.
function isQualComplete(l: Lead): boolean {
  return !!(
    l.produto &&
    l.experiencia && l.situacao && l.canal_vendas && l.estoque && l.historico && l.estrutura &&
    l.bant_budget && l.bant_authority && l.bant_need && l.bant_timing
  );
}

// Filtro por data de ENTRADA do lead no funil (created_at). Sem "tudo": null = todos.
type EntradaPreset = Exclude<PeriodPreset, "tudo">;
const ENTRADA_OPTIONS: { value: EntradaPreset; label: string }[] = [
  { value: "hoje", label: "Hoje" },
  { value: "ontem", label: "Ontem" },
  { value: "7d", label: "Últimos 7 dias" },
  { value: "14d", label: "Últimos 14 dias" },
  { value: "30d", label: "Últimos 30 dias" },
];

// Etapas que disparam celebração (dopamina).
function celebrationFor(status: LeadStatus | undefined): CelebrationKind | null {
  if (status === "reuniao_agendada") return "meeting";
  if (status === "negocio_ganho") return "win";
  return null;
}

export default function KanbanPage() {
  return (
    <Suspense fallback={null}>
      <KanbanContent />
    </Suspense>
  );
}

function KanbanContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const leadParam = searchParams.get("lead");

  const { leads, createLead, updateLead, deleteLead } = useLeadsContext();
  const { isAdmin, currentMember, sdrs, closers } = useTeamContext();
  const [newOpen, setNewOpen] = useState(false);
  const [newStatus, setNewStatus] = useState<LeadStatus | undefined>(undefined);
  const [selected, setSelected] = useState<Lead | null>(null);
  // Qual ?lead= já foi fechado pelo usuário (fecha o painel na hora, sem depender
  // da URL atualizar — evita o painel "travar" aberto quando vem da extensão).
  const [dismissedParam, setDismissedParam] = useState<string | null>(null);
  const [celebration, setCelebration] = useState<CelebrationKind | null>(null);
  // Filtros do funil. null = todos. Ficam salvos (localStorage) entre navegações.
  const [filterSdr, setFilterSdr] = useStickyState<string | null>("floow.kanban.sdr", null);
  const [filterCloser, setFilterCloser] = useStickyState<string | null>("floow.kanban.closer", null);
  const [filterPriority, setFilterPriority] = useStickyState<LeadPriority | null>("floow.kanban.prioridade", null);
  // Origem = fonte de marketing do lead (Meta Ads, Instagram, Indicação, …).
  const [filterOrigem, setFilterOrigem] = useStickyState<LeadFonte | null>("floow.kanban.fonte", null);
  const [filterSegmento, setFilterSegmento] = useStickyState<SegmentoConfeccao | null>("floow.kanban.segmento", null);
  const [filterProduto, setFilterProduto] = useStickyState<LeadProduto | null>("floow.kanban.produto", null);
  // Data de ENTRADA do lead no funil (created_at). null = todos.
  const [filterEntrada, setFilterEntrada] = useStickyState<EntradaPreset | null>("floow.kanban.entrada", null);

  function triggerCelebration(status: LeadStatus | undefined) {
    const kind = celebrationFor(status);
    if (kind) setCelebration(kind);
  }

  // Quantos filtros estão ativos (pro contador e o botão "Limpar").
  const activeFilters = [
    filterSdr, filterCloser, filterPriority, filterOrigem, filterSegmento, filterProduto, filterEntrada,
  ].filter(Boolean).length;

  function clearFilters() {
    setFilterSdr(null); setFilterCloser(null); setFilterPriority(null);
    setFilterOrigem(null); setFilterSegmento(null); setFilterProduto(null);
    setFilterEntrada(null);
  }

  // Todos veem o funil completo e filtram (responsável, prioridade, origem,
  // segmento, produto, data de entrada). Sem filtro = todos os leads.
  const visibleLeads = useMemo(() => {
    // Intervalo da data de entrada (resolvido uma vez, não por lead).
    const range = filterEntrada ? resolveRange({ kind: "preset", preset: filterEntrada }) : null;
    return leads.filter((l) => {
      if (filterSdr && l.sdr_responsavel !== filterSdr) return false;
      if (filterCloser && l.closer_responsavel !== filterCloser) return false;
      if (filterOrigem && l.fonte !== filterOrigem) return false;
      if (filterSegmento && l.segmento !== filterSegmento) return false;
      if (filterProduto && l.produto !== filterProduto) return false;
      if (range) {
        const entrou = new Date(l.created_at);
        if (range.start && entrou < range.start) return false;
        if (entrou > range.end) return false;
      }
      if (filterPriority) {
        // Prioridade só vale da etapa "Qualificado" em diante (não na Entrada).
        if (l.status === "qualificado") return false;
        const s = computeLeadScore(l);
        if (s.answered === 0 || s.priority !== filterPriority) return false;
      }
      return true;
    });
  }, [leads, filterSdr, filterCloser, filterOrigem, filterSegmento, filterProduto, filterPriority, filterEntrada]);
  const [pendingLost, setPendingLost] = useState<{
    id: string;
    name: string;
    extraPatch: Partial<Lead>;
  } | null>(null);
  const [pendingDisqualify, setPendingDisqualify] = useState<{
    id: string;
    name: string;
    extraPatch: Partial<Lead>;
  } | null>(null);
  // Carteira: pede o motivo e, logo depois, abre a criação da tarefa de recontato.
  const [pendingCarteira, setPendingCarteira] = useState<{
    id: string;
    name: string;
    extraPatch: Partial<Lead>;
  } | null>(null);
  const [taskForLead, setTaskForLead] = useState<Lead | null>(null);
  const [pendingComplete, setPendingComplete] = useState<{
    lead: Lead;
    targetStatus: LeadStatus;
    basePatch: Partial<Lead>;
  } | null>(null);
  // Info do negócio obrigatória ao entrar em "Pré qualificado".
  const [pendingPreQual, setPendingPreQual] = useState<{
    lead: Lead;
    targetStatus: LeadStatus;
    basePatch: Partial<Lead>;
  } | null>(null);
  // Antes de comemorar o ganho, pede o código do criativo que trouxe o cliente.
  const [pendingWin, setPendingWin] = useState<{
    id: string;
    name: string;
    patch: Partial<Lead>;
  } | null>(null);

  function askCreative(id: string, name: string, patch: Partial<Lead>) {
    setPendingWin({ id, name, patch });
  }

  // Ao agendar reunião: pede o Closer responsável + data/hora (obrigatórios).
  // O SDR (pré-vendas) continua o mesmo.
  const [pendingCloser, setPendingCloser] = useState<{
    id: string;
    name: string;
    patch: Partial<Lead>;
    initialCloser: string | null;
    initialDate: string | null;
    initialLocal: LocalReuniao | null;
  } | null>(null);

  function askCloser(
    id: string,
    name: string,
    patch: Partial<Lead>,
    initialCloser: string | null,
    initialDate: string | null,
    initialLocal: LocalReuniao | null,
  ) {
    setPendingCloser({ id, name, patch, initialCloser, initialDate, initialLocal });
  }

  async function handleConfirmCloser(closerName: string, dataIso: string, local: LocalReuniao) {
    if (!pendingCloser) return;
    await updateLead(pendingCloser.id, {
      ...pendingCloser.patch,
      closer_responsavel: closerName,
      data_agendamento: dataIso,
      local,
    });
    setPendingCloser(null);
    triggerCelebration("reuniao_agendada");
  }

  async function handleConfirmWin(criativo: number | null) {
    if (!pendingWin) return;
    const patch =
      criativo != null ? { ...pendingWin.patch, criativo_codigo: criativo } : pendingWin.patch;
    await updateLead(pendingWin.id, patch);
    setPendingWin(null);
    triggerCelebration("negocio_ganho");
  }

  // Lead selecionado: clicado no board, OU via ?lead=<id> (link da extensão/tarefa)
  // — mas só se esse ?lead ainda não foi fechado manualmente.
  const deepLead = leadParam && leadParam !== dismissedParam ? leadParam : null;
  const selectedLead = selected
    ? leads.find((l) => l.id === selected.id) ?? null
    : deepLead
      ? leads.find((l) => l.id === deepLead) ?? null
      : null;

  function closePanel() {
    setSelected(null);
    if (leadParam) {
      setDismissedParam(leadParam);           // fecha na hora
      router.replace("/kanban", { scroll: false }); // limpa a URL (best-effort)
    }
  }

  // Orquestra o avanço de etapa aplicando as travas em ordem:
  // 1) info do negócio (Pré qualificado) → 2) qualificação/BANT (Qualificado) →
  // 3) dados extras da etapa (motivo/criativo/closer). Quando tudo ok, salva.
  async function runMove(lead: Lead, target: LeadStatus, basePatch: Partial<Lead>) {
    const merged = { ...lead, ...basePatch } as Lead;
    const name = merged.empresa || merged.nome || "este lead";

    if (BUSINESS_STAGES.includes(target) && !isPreQualComplete(merged)) {
      setPendingPreQual({ lead, targetStatus: target, basePatch });
      return;
    }
    if (QUAL_STAGES.includes(target) && !isQualComplete(merged)) {
      setPendingComplete({ lead, targetStatus: target, basePatch });
      return;
    }
    if (target === "negocio_perdido" && lead.status !== "negocio_perdido") {
      setPendingLost({ id: lead.id, name, extraPatch: { ...basePatch, status: target } });
      return;
    }
    if (target === "negocio_ganho" && lead.status !== "negocio_ganho") {
      askCreative(lead.id, name, { ...basePatch, status: target });
      return;
    }
    if (target === "desqualificado" && lead.status !== "desqualificado") {
      setPendingDisqualify({ id: lead.id, name, extraPatch: { ...basePatch, status: target } });
      return;
    }
    if (target === "carteira" && lead.status !== "carteira") {
      setPendingCarteira({ id: lead.id, name, extraPatch: { ...basePatch, status: target } });
      return;
    }
    if (target === "reuniao_agendada" && lead.status !== "reuniao_agendada") {
      askCloser(lead.id, name, { ...basePatch, status: target }, lead.closer_responsavel ?? null, lead.data_agendamento ?? null, lead.local ?? null);
      return;
    }
    await updateLead(lead.id, { ...basePatch, status: target });
    triggerCelebration(target);
  }

  async function handleMove(id: string, newStatus: LeadStatus) {
    const lead = leads.find((l) => l.id === id);
    if (!lead) return;
    await runMove(lead, newStatus, {});
  }

  async function handleUpdate(id: string, patch: Partial<Lead>) {
    const lead = leads.find((l) => l.id === id);
    if (!lead) return;
    // Mudança de etapa passa pelas travas; edição sem mudar etapa salva direto.
    if (patch.status && patch.status !== lead.status) {
      const { status, ...rest } = patch;
      await runMove(lead, status, rest);
    } else {
      await updateLead(id, patch);
    }
  }

  async function handleConfirmLost(motivo: MotivoPerda) {
    if (!pendingLost) return;
    await updateLead(pendingLost.id, { ...pendingLost.extraPatch, motivo_perda: motivo });
    setPendingLost(null);
  }

  async function handleConfirmDisqualify(motivo: MotivoDesqualificacao) {
    if (!pendingDisqualify) return;
    await updateLead(pendingDisqualify.id, { ...pendingDisqualify.extraPatch, motivo_desqualificacao: motivo });
    setPendingDisqualify(null);
  }

  // Carteira: salva o motivo, move o lead e emenda no popup de agendar a tarefa.
  async function handleConfirmCarteira(motivo: MotivoCarteira) {
    if (!pendingCarteira) return;
    const { id, extraPatch } = pendingCarteira;
    await updateLead(id, { ...extraPatch, motivo_carteira: motivo });
    setPendingCarteira(null);
    const moved = leads.find((l) => l.id === id);
    if (moved) setTaskForLead(moved);
  }

  return (
    <>
      <TopBar title="Funis de vendas" onNewLead={() => { setNewStatus(undefined); setNewOpen(true); }} />

      {/* Toolbar: busca + filtros em chips (acendem quando ativos) */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-zinc-900 bg-[#0a0a0a] px-4 py-2.5 sm:px-6">
        <LeadSearch leads={visibleLeads} onSelect={(lead) => setSelected(lead)} />

        <div className="flex flex-wrap items-center gap-1.5">
          <FilterChip
            label="SDR" allLabel="Todos"
            value={filterSdr ?? ""} onChange={(v) => setFilterSdr(v || null)}
            options={sdrs.map((m) => ({ value: m.name, label: m.name }))}
          />
          <FilterChip
            label="Closer" allLabel="Todos"
            value={filterCloser ?? ""} onChange={(v) => setFilterCloser(v || null)}
            options={closers.map((m) => ({ value: m.name, label: m.name }))}
          />
          <FilterChip
            label="Prioridade" allLabel="Todas"
            value={filterPriority ?? ""} onChange={(v) => setFilterPriority((v || null) as LeadPriority | null)}
            options={[
              { value: "alta", label: `🔥 ${PRIORITY_SHORT.alta}` },
              { value: "media", label: `⏳ ${PRIORITY_SHORT.media}` },
              { value: "baixa", label: `🧊 ${PRIORITY_SHORT.baixa}` },
            ]}
          />
          <FilterChip
            label="Origem" allLabel="Todas"
            value={filterOrigem ?? ""} onChange={(v) => setFilterOrigem((v || null) as LeadFonte | null)}
            options={FONTE_OPTIONS.map((f) => ({ value: f, label: FONTE_LABELS[f] }))}
          />
          <FilterChip
            label="Segmento" allLabel="Todos"
            value={filterSegmento ?? ""} onChange={(v) => setFilterSegmento((v || null) as SegmentoConfeccao | null)}
            options={(Object.keys(SEGMENTO_LABELS) as SegmentoConfeccao[]).map((s) => ({ value: s, label: SEGMENTO_LABELS[s] }))}
          />
          <FilterChip
            label="Produto" allLabel="Todos"
            value={filterProduto ?? ""} onChange={(v) => setFilterProduto((v || null) as LeadProduto | null)}
            options={PRODUTO_OPTIONS.map((p) => ({ value: p, label: PRODUTO_LABELS[p] }))}
          />
          <FilterChip
            label="Entrada" allLabel="Qualquer data" icon={<CalendarDays size={12} />}
            value={filterEntrada ?? ""} onChange={(v) => setFilterEntrada((v || null) as EntradaPreset | null)}
            options={ENTRADA_OPTIONS}
          />
        </div>

        {activeFilters > 0 && (
          <div className="ml-auto flex items-center gap-2">
            <span className="rounded-md border border-zinc-800 bg-zinc-900/70 px-2 py-1 text-[11px] font-medium tabular-nums text-zinc-300">
              {visibleLeads.length} {visibleLeads.length === 1 ? "lead" : "leads"}
            </span>
            <button
              onClick={clearFilters}
              className="flex items-center gap-1 rounded-lg border border-zinc-800 bg-zinc-900/70 px-2.5 py-1.5 text-[11px] font-medium text-zinc-400 transition-colors hover:border-rose-500/40 hover:bg-rose-500/10 hover:text-rose-300"
            >
              <X size={12} />
              Limpar
              {activeFilters > 1 && <span className="tabular-nums opacity-60">({activeFilters})</span>}
            </button>
          </div>
        )}
      </div>

      <main className="flex-1 overflow-hidden">
        <Board
          leads={visibleLeads}
          onMove={handleMove}
          onCardClick={(lead) => setSelected(lead)}
          onCreate={(status) => { setNewStatus(status); setNewOpen(true); }}
          viewerRole={isAdmin || currentMember?.role === "Trafego" ? null : currentMember?.role ?? null}
          isAdmin={isAdmin}
        />
      </main>

      {celebration && (
        <Celebration kind={celebration} onDone={() => setCelebration(null)} />
      )}

      <NewLeadDialog
        open={newOpen}
        initialStatus={newStatus}
        onClose={() => setNewOpen(false)}
        onOpenExisting={(lead) => setSelected(lead)}
        onSubmit={async (input) => {
          const created = await createLead(input);
          triggerCelebration(created?.status);
        }}
      />

      {selectedLead && (
        <LeadDetailsPanel
          key={selectedLead.id}
          lead={selectedLead}
          onClose={closePanel}
          onUpdate={handleUpdate}
          onDelete={async (id) => {
            await deleteLead(id);
          }}
        />
      )}

      <LostReasonDialog
        open={pendingLost != null}
        leadName={pendingLost?.name ?? ""}
        onCancel={() => setPendingLost(null)}
        onConfirm={handleConfirmLost}
      />

      <DisqualifyDialog
        open={pendingDisqualify != null}
        leadName={pendingDisqualify?.name ?? ""}
        onCancel={() => setPendingDisqualify(null)}
        onConfirm={handleConfirmDisqualify}
      />

      <CarteiraReasonDialog
        open={pendingCarteira != null}
        leadName={pendingCarteira?.name ?? ""}
        onCancel={() => setPendingCarteira(null)}
        onConfirm={handleConfirmCarteira}
      />

      {/* Emenda do fluxo da Carteira: agendar a tarefa de recontato do negócio. */}
      <NewTaskDialog
        open={taskForLead != null}
        lead={taskForLead}
        onClose={() => setTaskForLead(null)}
      />

      {pendingPreQual && (
        <CompletePreQualDialog
          lead={pendingPreQual.lead}
          targetStatus={pendingPreQual.targetStatus}
          onCancel={() => setPendingPreQual(null)}
          onConfirm={async (patch) => {
            const { lead, targetStatus, basePatch } = pendingPreQual;
            setPendingPreQual(null);
            await runMove(lead, targetStatus, { ...basePatch, ...patch });
          }}
        />
      )}

      {pendingComplete && (
        <CompleteQualificationDialog
          lead={pendingComplete.lead}
          targetStatus={pendingComplete.targetStatus}
          onCancel={() => setPendingComplete(null)}
          onConfirm={async (patch) => {
            const { lead, targetStatus, basePatch } = pendingComplete;
            setPendingComplete(null);
            await runMove(lead, targetStatus, { ...basePatch, ...patch });
          }}
        />
      )}

      <CreativeCodeDialog
        open={pendingWin != null}
        leadName={pendingWin?.name ?? ""}
        onCancel={() => setPendingWin(null)}
        onConfirm={handleConfirmWin}
      />

      <CloserSelectDialog
        open={pendingCloser != null}
        leadName={pendingCloser?.name ?? ""}
        closers={closers}
        initialCloser={pendingCloser?.initialCloser}
        initialDate={pendingCloser?.initialDate}
        initialLocal={pendingCloser?.initialLocal}
        onCancel={() => setPendingCloser(null)}
        onConfirm={handleConfirmCloser}
      />
    </>
  );
}

/**
 * Chip de filtro: mostra só o rótulo quando inativo e "Rótulo · Valor" destacado
 * em amarelo quando ativo — dá pra bater o olho e ver o que está filtrando.
 * O <select> nativo fica por cima (invisível) pra manter o comportamento e a
 * acessibilidade do dropdown do sistema.
 */
function FilterChip({
  label, value, onChange, options, allLabel = "Todos", icon,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  allLabel?: string;
  icon?: React.ReactNode;
}) {
  const active = value !== "";
  const current = options.find((o) => o.value === value)?.label ?? "";

  return (
    <div
      className={`relative flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs transition-colors ${
        active
          ? "border-[#f5c518]/40 bg-[#f5c518]/10 text-[#f5c518] hover:border-[#f5c518]/60"
          : "border-zinc-800 bg-zinc-900/70 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200"
      }`}
    >
      {icon && <span className="shrink-0 opacity-70">{icon}</span>}
      <span className={`shrink-0 font-medium ${active ? "opacity-60" : ""}`}>{label}</span>
      {active && (
        <span className="max-w-[120px] truncate font-semibold">{current}</span>
      )}
      <ChevronDown size={12} className="shrink-0 opacity-50" />

      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label={`Filtrar por ${label}`}
        className="absolute inset-0 cursor-pointer opacity-0 [color-scheme:dark]"
      >
        <option value="">{allLabel}</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </div>
  );
}
