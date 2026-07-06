"use client";

import { Suspense, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Board } from "@/components/kanban/Board";
import { LeadSearch } from "@/components/kanban/LeadSearch";
import { TopBar } from "@/components/layout/TopBar";
import { CloserSelectDialog } from "@/components/lead/CloserSelectDialog";
import { CompleteQualificationDialog } from "@/components/lead/CompleteQualificationDialog";
import { CreativeCodeDialog } from "@/components/lead/CreativeCodeDialog";
import { DisqualifyDialog } from "@/components/lead/DisqualifyDialog";
import { LeadDetailsPanel } from "@/components/lead/LeadDetailsPanel";
import { LostReasonDialog } from "@/components/lead/LostReasonDialog";
import { NewLeadDialog } from "@/components/lead/NewLeadDialog";
import { Celebration, type CelebrationKind } from "@/components/ui/Celebration";
import { useLeadsContext } from "@/lib/contexts/LeadsContext";
import { useTeamContext } from "@/lib/contexts/TeamContext";
import { PRODUTO_LABELS, PRODUTO_OPTIONS, SEGMENTO_LABELS, type Lead, type LeadProduto, type LeadStatus, type MotivoDesqualificacao, type MotivoPerda, type SegmentoConfeccao } from "@/lib/types";
import { computeLeadScore, PRIORITY_SHORT, type LeadPriority } from "@/lib/lead-score";

// Etapas que NÃO exigem qualificação: Entrada (lead só chegou) e as saídas
// (perdido, sem resposta, desqualificado). Qualquer outra exige a qualificação.
const NO_QUAL_STAGES: LeadStatus[] = ["qualificado", "negocio_perdido", "sem_resposta", "desqualificado"];

// Lead só avança além da zona inicial depois de toda a qualificação preenchida.
function isQualComplete(l: Lead): boolean {
  return !!(
    l.produto &&
    l.experiencia && l.situacao && l.canal_vendas && l.estoque && l.historico && l.estrutura &&
    l.bant_budget && l.bant_authority && l.bant_need && l.bant_timing
  );
}

// Exige qualificação completa ao entrar em "Qualificado" (em_agendamento) e nas
// etapas seguintes até o ganho. Entrada e as saídas (perdido/sem resposta/
// desqualificado) não exigem.
function needsCompletion(lead: Lead, newStatus: LeadStatus): boolean {
  return (
    lead.status !== newStatus &&
    !NO_QUAL_STAGES.includes(newStatus) &&
    !isQualComplete(lead)
  );
}

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

  const { leads, createLead, updateLead, moveLead, deleteLead } = useLeadsContext();
  const { isAdmin, currentMember, sdrs, closers } = useTeamContext();
  const [newOpen, setNewOpen] = useState(false);
  const [newStatus, setNewStatus] = useState<LeadStatus | undefined>(undefined);
  const [selected, setSelected] = useState<Lead | null>(null);
  const [celebration, setCelebration] = useState<CelebrationKind | null>(null);
  // Filtros do funil. null = todos.
  const [filterSdr, setFilterSdr] = useState<string | null>(null);
  const [filterCloser, setFilterCloser] = useState<string | null>(null);
  const [filterPriority, setFilterPriority] = useState<LeadPriority | null>(null);
  const [filterOrigem, setFilterOrigem] = useState<"whatsapp" | "manual" | null>(null);
  const [filterSegmento, setFilterSegmento] = useState<SegmentoConfeccao | null>(null);
  const [filterProduto, setFilterProduto] = useState<LeadProduto | null>(null);

  function triggerCelebration(status: LeadStatus | undefined) {
    const kind = celebrationFor(status);
    if (kind) setCelebration(kind);
  }

  // Todos veem o funil completo e filtram (responsável, prioridade, origem,
  // segmento). Sem filtro = todos os leads.
  const visibleLeads = useMemo(() => {
    return leads.filter((l) => {
      if (filterSdr && l.sdr_responsavel !== filterSdr) return false;
      if (filterCloser && l.closer_responsavel !== filterCloser) return false;
      if (filterOrigem === "whatsapp" && l.origem !== "whatsapp") return false;
      if (filterOrigem === "manual" && l.origem === "whatsapp") return false;
      if (filterSegmento && l.segmento !== filterSegmento) return false;
      if (filterProduto && l.produto !== filterProduto) return false;
      if (filterPriority) {
        // Prioridade só vale da etapa "Qualificado" em diante (não na Entrada).
        if (l.status === "qualificado") return false;
        const s = computeLeadScore(l);
        if (s.answered === 0 || s.priority !== filterPriority) return false;
      }
      return true;
    });
  }, [leads, filterSdr, filterCloser, filterOrigem, filterSegmento, filterProduto, filterPriority]);
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
  const [pendingComplete, setPendingComplete] = useState<{
    lead: Lead;
    targetStatus: LeadStatus;
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
  } | null>(null);

  function askCloser(
    id: string,
    name: string,
    patch: Partial<Lead>,
    initialCloser: string | null,
    initialDate: string | null,
  ) {
    setPendingCloser({ id, name, patch, initialCloser, initialDate });
  }

  async function handleConfirmCloser(closerName: string, dataIso: string) {
    if (!pendingCloser) return;
    await updateLead(pendingCloser.id, {
      ...pendingCloser.patch,
      closer_responsavel: closerName,
      data_agendamento: dataIso,
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

  // Lead selecionado: ou foi clicado no board, ou veio via ?lead=<id> (link de uma tarefa).
  const selectedLead = selected
    ? leads.find((l) => l.id === selected.id) ?? null
    : leadParam
      ? leads.find((l) => l.id === leadParam) ?? null
      : null;

  function closePanel() {
    setSelected(null);
    if (leadParam) router.replace("/kanban", { scroll: false });
  }

  async function handleMove(id: string, newStatus: LeadStatus) {
    const lead = leads.find((l) => l.id === id);
    if (lead && needsCompletion(lead, newStatus)) {
      setPendingComplete({ lead, targetStatus: newStatus });
      return;
    }
    if (newStatus === "negocio_perdido" && lead?.status !== "negocio_perdido") {
      setPendingLost({
        id,
        name: lead?.empresa || lead?.nome || "este lead",
        extraPatch: { status: "negocio_perdido" },
      });
      return;
    }
    if (newStatus === "negocio_ganho" && lead?.status !== "negocio_ganho") {
      askCreative(id, lead?.empresa || lead?.nome || "este lead", { status: "negocio_ganho" });
      return;
    }
    if (newStatus === "desqualificado" && lead?.status !== "desqualificado") {
      setPendingDisqualify({
        id,
        name: lead?.empresa || lead?.nome || "este lead",
        extraPatch: { status: "desqualificado" },
      });
      return;
    }
    if (newStatus === "reuniao_agendada" && lead?.status !== "reuniao_agendada") {
      askCloser(id, lead?.empresa || lead?.nome || "este lead", { status: "reuniao_agendada" }, lead?.closer_responsavel ?? null, lead?.data_agendamento ?? null);
      return;
    }
    await moveLead(id, newStatus);
    triggerCelebration(newStatus);
  }

  async function handleUpdate(id: string, patch: Partial<Lead>) {
    const lead = leads.find((l) => l.id === id);
    if (lead && patch.status && needsCompletion(lead, patch.status)) {
      setPendingComplete({ lead, targetStatus: patch.status });
      return;
    }
    if (
      patch.status === "negocio_perdido" &&
      lead?.status !== "negocio_perdido"
    ) {
      setPendingLost({
        id,
        name: lead?.empresa || lead?.nome || "este lead",
        extraPatch: patch,
      });
      return;
    }
    if (patch.status === "negocio_ganho" && lead?.status !== "negocio_ganho") {
      askCreative(id, lead?.empresa || lead?.nome || "este lead", patch);
      return;
    }
    if (patch.status === "desqualificado" && lead?.status !== "desqualificado") {
      setPendingDisqualify({
        id,
        name: lead?.empresa || lead?.nome || "este lead",
        extraPatch: patch,
      });
      return;
    }
    if (patch.status === "reuniao_agendada" && lead?.status !== "reuniao_agendada") {
      askCloser(id, lead?.empresa || lead?.nome || "este lead", patch, lead?.closer_responsavel ?? null, lead?.data_agendamento ?? null);
      return;
    }
    const statusChanged = patch.status && patch.status !== lead?.status;
    await updateLead(id, patch);
    if (statusChanged) triggerCelebration(patch.status);
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

  return (
    <>
      <TopBar title="Funis de vendas" onNewLead={() => { setNewStatus(undefined); setNewOpen(true); }} />

      {/* Toolbar: busca + filtros (responsável, prioridade, origem, segmento) */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-zinc-900 bg-[#0a0a0a] px-4 py-2 sm:px-6">
        <LeadSearch leads={visibleLeads} onSelect={(lead) => setSelected(lead)} />

        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <FilterSelect label="SDR" value={filterSdr ?? ""} onChange={(v) => setFilterSdr(v || null)}>
            <option value="">Todos</option>
            {sdrs.map((m) => <option key={m.id} value={m.name}>{m.name}</option>)}
          </FilterSelect>

          <FilterSelect label="Closer" value={filterCloser ?? ""} onChange={(v) => setFilterCloser(v || null)}>
            <option value="">Todos</option>
            {closers.map((m) => <option key={m.id} value={m.name}>{m.name}</option>)}
          </FilterSelect>

          <FilterSelect label="Prioridade" value={filterPriority ?? ""} onChange={(v) => setFilterPriority((v || null) as LeadPriority | null)}>
            <option value="">Todas</option>
            <option value="alta">🔥 {PRIORITY_SHORT.alta}</option>
            <option value="media">⏳ {PRIORITY_SHORT.media}</option>
            <option value="baixa">🧊 {PRIORITY_SHORT.baixa}</option>
          </FilterSelect>

          <FilterSelect label="Origem" value={filterOrigem ?? ""} onChange={(v) => setFilterOrigem((v || null) as "whatsapp" | "manual" | null)}>
            <option value="">Todas</option>
            <option value="whatsapp">Anúncio (WhatsApp)</option>
            <option value="manual">Manual</option>
          </FilterSelect>

          <FilterSelect label="Segmento" value={filterSegmento ?? ""} onChange={(v) => setFilterSegmento((v || null) as SegmentoConfeccao | null)}>
            <option value="">Todos</option>
            {(Object.keys(SEGMENTO_LABELS) as SegmentoConfeccao[]).map((s) => (
              <option key={s} value={s}>{SEGMENTO_LABELS[s]}</option>
            ))}
          </FilterSelect>

          <FilterSelect label="Produto" value={filterProduto ?? ""} onChange={(v) => setFilterProduto((v || null) as LeadProduto | null)}>
            <option value="">Todos</option>
            {PRODUTO_OPTIONS.map((p) => (
              <option key={p} value={p}>{PRODUTO_LABELS[p]}</option>
            ))}
          </FilterSelect>

          {(filterSdr || filterCloser || filterPriority || filterOrigem || filterSegmento || filterProduto) && (
            <>
              <span className="text-[11px] text-zinc-400">
                {visibleLeads.length} {visibleLeads.length === 1 ? "lead" : "leads"}
              </span>
              <button
                onClick={() => {
                  setFilterSdr(null); setFilterCloser(null); setFilterPriority(null);
                  setFilterOrigem(null); setFilterSegmento(null); setFilterProduto(null);
                }}
                className="text-[11px] text-zinc-500 underline-offset-2 hover:text-zinc-300 hover:underline"
              >
                limpar
              </button>
            </>
          )}
        </div>
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

      {pendingComplete && (
        <CompleteQualificationDialog
          lead={pendingComplete.lead}
          targetStatus={pendingComplete.targetStatus}
          onCancel={() => setPendingComplete(null)}
          onConfirm={async (patch) => {
            const { lead, targetStatus } = pendingComplete;
            setPendingComplete(null);
            // Qualificou e já foi direto pra ganho: ainda pede o criativo.
            if (targetStatus === "negocio_ganho") {
              askCreative(lead.id, lead.empresa || lead.nome || "este lead", patch);
              return;
            }
            // Qualificou e agendou: pede o Closer responsável + data.
            if (targetStatus === "reuniao_agendada") {
              askCloser(lead.id, lead.empresa || lead.nome || "este lead", patch, lead.closer_responsavel ?? null, lead.data_agendamento ?? null);
              return;
            }
            await updateLead(lead.id, patch);
            triggerCelebration(targetStatus);
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
        onCancel={() => setPendingCloser(null)}
        onConfirm={handleConfirmCloser}
      />
    </>
  );
}

function FilterSelect({
  label, value, onChange, children,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  children: React.ReactNode;
}) {
  return (
    <label className="flex items-center gap-1.5">
      <span className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-md border border-zinc-800 bg-zinc-900 px-2 py-1 text-xs text-zinc-200 outline-none focus:border-[#f5c518]"
      >
        {children}
      </select>
    </label>
  );
}
