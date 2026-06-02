"use client";

import { useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { TopBar } from "@/components/layout/TopBar";
import { MeetingModal } from "@/components/agenda/MeetingModal";
import { MonthView } from "@/components/agenda/MonthView";
import { WeekView } from "@/components/agenda/WeekView";
import { LostReasonDialog } from "@/components/lead/LostReasonDialog";
import { useLeadsContext } from "@/lib/contexts/LeadsContext";
import type { Lead, MotivoPerda } from "@/lib/types";

type ViewMode = "mes" | "semana";

export default function AgendaPage() {
  const { leads, updateLead, deleteLead } = useLeadsContext();
  const [view, setView] = useState<ViewMode>("mes");
  const [cursor, setCursor] = useState(new Date());
  const [selected, setSelected] = useState<Lead | null>(null);
  const [pendingLost, setPendingLost] = useState<{
    id: string;
    name: string;
    extraPatch: Partial<Lead>;
  } | null>(null);

  const selectedLead = selected ? leads.find((l) => l.id === selected.id) ?? null : null;

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

  function prev() {
    const d = new Date(cursor);
    if (view === "mes") d.setMonth(d.getMonth() - 1);
    else d.setDate(d.getDate() - 7);
    setCursor(d);
  }

  function next() {
    const d = new Date(cursor);
    if (view === "mes") d.setMonth(d.getMonth() + 1);
    else d.setDate(d.getDate() + 7);
    setCursor(d);
  }

  function goToday() {
    setCursor(new Date());
  }

  const title =
    view === "mes"
      ? format(cursor, "MMMM 'de' yyyy", { locale: ptBR })
      : `Semana de ${format(startOfWeek(cursor), "d MMM", { locale: ptBR })}`;

  return (
    <>
      <TopBar title="Agenda" />

      <div className="flex items-center justify-between border-b border-zinc-900 px-4 py-2 sm:px-6">
        <div className="flex items-center gap-1.5">
          <button
            onClick={prev}
            className="rounded p-1.5 text-zinc-400 hover:bg-zinc-900 hover:text-zinc-100"
            aria-label="Anterior"
          >
            <ChevronLeft size={16} />
          </button>
          <button
            onClick={goToday}
            className="rounded-md border border-zinc-800 bg-zinc-900 px-3 py-1 text-xs text-zinc-300 hover:border-zinc-700 hover:text-zinc-100"
          >
            Hoje
          </button>
          <button
            onClick={next}
            className="rounded p-1.5 text-zinc-400 hover:bg-zinc-900 hover:text-zinc-100"
            aria-label="Próximo"
          >
            <ChevronRight size={16} />
          </button>
          <h2 className="ml-2 text-sm font-semibold capitalize text-zinc-200">{title}</h2>
        </div>

        <div className="flex rounded-md border border-zinc-800 bg-zinc-900 p-0.5 text-xs">
          {(["mes", "semana"] as ViewMode[]).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`rounded px-3 py-1 transition-colors ${
                view === v
                  ? "bg-[#f5c518] font-semibold text-zinc-950"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              {v === "mes" ? "Mês" : "Semana"}
            </button>
          ))}
        </div>
      </div>

      <main className="flex flex-1 flex-col overflow-hidden">
        {view === "mes" ? (
          <MonthView cursor={cursor} leads={leads} onClickLead={setSelected} />
        ) : (
          <WeekView cursor={cursor} leads={leads} onClickLead={setSelected} />
        )}
      </main>

      {selectedLead && (
        <MeetingModal
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

function startOfWeek(d: Date) {
  const x = new Date(d);
  const day = x.getDay();
  const diff = (day === 0 ? -6 : 1) - day;
  x.setDate(x.getDate() + diff);
  x.setHours(0, 0, 0, 0);
  return x;
}
