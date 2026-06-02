"use client";

import { useState } from "react";
import { Board } from "@/components/kanban/Board";
import { TopBar } from "@/components/layout/TopBar";
import { LeadDetailsPanel } from "@/components/lead/LeadDetailsPanel";
import { LostReasonDialog } from "@/components/lead/LostReasonDialog";
import { NewLeadDialog } from "@/components/lead/NewLeadDialog";
import { useLeadsContext } from "@/lib/contexts/LeadsContext";
import type { Lead, LeadStatus, MotivoPerda } from "@/lib/types";

export default function KanbanPage() {
  const { leads, createLead, updateLead, moveLead, deleteLead } = useLeadsContext();
  const [newOpen, setNewOpen] = useState(false);
  const [selected, setSelected] = useState<Lead | null>(null);
  const [pendingLost, setPendingLost] = useState<{
    id: string;
    name: string;
    extraPatch: Partial<Lead>;
  } | null>(null);

  const selectedLead = selected ? leads.find((l) => l.id === selected.id) ?? null : null;

  async function handleMove(id: string, newStatus: LeadStatus) {
    const lead = leads.find((l) => l.id === id);
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
      <TopBar title="Funis de vendas" onNewLead={() => setNewOpen(true)} />

      <main className="flex-1 overflow-hidden">
        <Board
          leads={leads}
          onMove={handleMove}
          onCardClick={(lead) => setSelected(lead)}
        />
      </main>

      <NewLeadDialog
        open={newOpen}
        onClose={() => setNewOpen(false)}
        onSubmit={async (input) => {
          await createLead(input);
        }}
      />

      {selectedLead && (
        <LeadDetailsPanel
          key={selectedLead.id}
          lead={selectedLead}
          onClose={() => setSelected(null)}
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
    </>
  );
}
