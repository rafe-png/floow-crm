"use client";

import { Suspense, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Board } from "@/components/kanban/Board";
import { LeadSearch } from "@/components/kanban/LeadSearch";
import { TopBar } from "@/components/layout/TopBar";
import { CompleteQualificationDialog } from "@/components/lead/CompleteQualificationDialog";
import { CreativeCodeDialog } from "@/components/lead/CreativeCodeDialog";
import { DisqualifyDialog } from "@/components/lead/DisqualifyDialog";
import { LeadDetailsPanel } from "@/components/lead/LeadDetailsPanel";
import { LostReasonDialog } from "@/components/lead/LostReasonDialog";
import { NewLeadDialog } from "@/components/lead/NewLeadDialog";
import { Celebration, type CelebrationKind } from "@/components/ui/Celebration";
import { useLeadsContext } from "@/lib/contexts/LeadsContext";
import { useTeamContext } from "@/lib/contexts/TeamContext";
import type { Lead, LeadStatus, MotivoDesqualificacao, MotivoPerda } from "@/lib/types";

// Etapas iniciais (zona do SDR) — qualificar/agendar acontece aqui.
const EARLY_STAGES: LeadStatus[] = ["qualificado", "em_agendamento"];

// Lead só avança além da zona inicial depois de toda a qualificação preenchida.
function isQualComplete(l: Lead): boolean {
  return !!(
    l.experiencia && l.situacao && l.canal_vendas && l.estoque && l.historico && l.estrutura &&
    l.bant_budget && l.bant_authority && l.bant_need && l.bant_timing
  );
}

// Exige completar ao avançar da zona inicial (Qualificado/Em agendamento) para a
// reunião em diante. Mover entre as etapas iniciais ou descartar é livre.
function needsCompletion(lead: Lead, newStatus: LeadStatus): boolean {
  return (
    EARLY_STAGES.includes(lead.status) &&
    !EARLY_STAGES.includes(newStatus) &&
    newStatus !== "negocio_perdido" &&
    newStatus !== "desqualificado" &&
    newStatus !== "sem_resposta" &&
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
  // Filtros por responsável (SDR e Closer, independentes). null = todos.
  const [filterSdr, setFilterSdr] = useState<string | null>(null);
  const [filterCloser, setFilterCloser] = useState<string | null>(null);

  function triggerCelebration(status: LeadStatus | undefined) {
    const kind = celebrationFor(status);
    if (kind) setCelebration(kind);
  }

  // Todos veem o funil completo e filtram por responsável (SDR e/ou Closer,
  // independentes). Sem filtro = todos os leads.
  const visibleLeads = useMemo(() => {
    return leads.filter(
      (l) =>
        (!filterSdr || l.sdr_responsavel === filterSdr) &&
        (!filterCloser || l.closer_responsavel === filterCloser),
    );
  }, [leads, filterSdr, filterCloser]);
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

      {/* Toolbar: busca + filtros por responsável (SDR e Closer), pra todos */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-zinc-900 bg-[#0a0a0a] px-4 py-2 sm:px-6">
        <LeadSearch leads={visibleLeads} onSelect={(lead) => setSelected(lead)} />

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">SDR</span>
          <select
            value={filterSdr ?? ""}
            onChange={(e) => setFilterSdr(e.target.value || null)}
            className="rounded-md border border-zinc-800 bg-zinc-900 px-2.5 py-1 text-xs text-zinc-200 outline-none focus:border-[#f5c518]"
          >
            <option value="">Todos</option>
            {sdrs.map((m) => (
              <option key={m.id} value={m.name}>{m.name}</option>
            ))}
          </select>

          <span className="ml-1 text-[11px] font-medium uppercase tracking-wide text-zinc-500">Closer</span>
          <select
            value={filterCloser ?? ""}
            onChange={(e) => setFilterCloser(e.target.value || null)}
            className="rounded-md border border-zinc-800 bg-zinc-900 px-2.5 py-1 text-xs text-zinc-200 outline-none focus:border-[#f5c518]"
          >
            <option value="">Todos</option>
            {closers.map((m) => (
              <option key={m.id} value={m.name}>{m.name}</option>
            ))}
          </select>

          {(filterSdr || filterCloser) && (
            <>
              <span className="text-[11px] text-zinc-500">
                {visibleLeads.length} {visibleLeads.length === 1 ? "lead" : "leads"}
              </span>
              <button
                onClick={() => { setFilterSdr(null); setFilterCloser(null); }}
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
    </>
  );
}
