"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Board } from "@/components/kanban/Board";
import { TopBar } from "@/components/layout/TopBar";
import { CompleteQualificationDialog } from "@/components/lead/CompleteQualificationDialog";
import { LeadDetailsPanel } from "@/components/lead/LeadDetailsPanel";
import { LostReasonDialog } from "@/components/lead/LostReasonDialog";
import { NewLeadDialog } from "@/components/lead/NewLeadDialog";
import { useLeadsContext } from "@/lib/contexts/LeadsContext";
import type { Lead, LeadStatus, MotivoPerda } from "@/lib/types";

// Lead "Qualificado" só pode avançar no funil depois de toda a qualificação preenchida.
function isQualComplete(l: Lead): boolean {
  return !!(
    l.experiencia && l.situacao && l.canal_vendas && l.estoque && l.historico && l.estrutura &&
    l.bant_budget && l.bant_authority && l.bant_need && l.bant_timing
  );
}

// Exige completar ao sair de "Qualificado" para qualquer etapa (exceto descartar como perdido).
function needsCompletion(lead: Lead, newStatus: LeadStatus): boolean {
  return (
    lead.status === "qualificado" &&
    newStatus !== "qualificado" &&
    newStatus !== "negocio_perdido" &&
    !isQualComplete(lead)
  );
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
  const [newOpen, setNewOpen] = useState(false);
  const [newStatus, setNewStatus] = useState<LeadStatus | undefined>(undefined);
  const [selected, setSelected] = useState<Lead | null>(null);
  const [pendingLost, setPendingLost] = useState<{
    id: string;
    name: string;
    extraPatch: Partial<Lead>;
  } | null>(null);
  const [pendingComplete, setPendingComplete] = useState<{
    lead: Lead;
    targetStatus: LeadStatus;
  } | null>(null);

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
    await moveLead(id, newStatus);
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
    await updateLead(id, patch);
  }

  async function handleConfirmLost(motivo: MotivoPerda) {
    if (!pendingLost) return;
    await updateLead(pendingLost.id, { ...pendingLost.extraPatch, motivo_perda: motivo });
    setPendingLost(null);
  }

  return (
    <>
      <TopBar title="Funis de vendas" onNewLead={() => { setNewStatus(undefined); setNewOpen(true); }} />

      <main className="flex-1 overflow-hidden">
        <Board
          leads={leads}
          onMove={handleMove}
          onCardClick={(lead) => setSelected(lead)}
          onCreate={(status) => { setNewStatus(status); setNewOpen(true); }}
        />
      </main>

      <NewLeadDialog
        open={newOpen}
        initialStatus={newStatus}
        onClose={() => setNewOpen(false)}
        onSubmit={async (input) => {
          await createLead(input);
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

      {pendingComplete && (
        <CompleteQualificationDialog
          lead={pendingComplete.lead}
          targetStatus={pendingComplete.targetStatus}
          onCancel={() => setPendingComplete(null)}
          onConfirm={async (patch) => {
            await updateLead(pendingComplete.lead.id, patch);
            setPendingComplete(null);
          }}
        />
      )}
    </>
  );
}
