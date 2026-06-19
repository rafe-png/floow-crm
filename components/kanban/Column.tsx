"use client";

import { useDroppable } from "@dnd-kit/core";
import { Lock, Plus } from "lucide-react";
import { LeadCard } from "./LeadCard";
import { STATUS_COLORS, STATUS_LABELS, type Lead, type LeadFonte, type LeadStatus } from "@/lib/types";

type Props = {
  status: LeadStatus;
  leads: Lead[];
  onCardClick: (lead: Lead) => void;
  onCreate: (status: LeadStatus) => void;
  onChangeFonte: (id: string, fonte: LeadFonte) => void;
  /** Etapa do Closer que o viewer (SDR) não pode mexer: mais escura e sem drop */
  locked?: boolean;
};

export function Column({ status, leads, onCardClick, onCreate, onChangeFonte, locked = false }: Props) {
  const { setNodeRef, isOver } = useDroppable({ id: status, disabled: locked });
  const colors = STATUS_COLORS[status];

  return (
    <div
      className={`flex h-full w-[280px] shrink-0 flex-col rounded-xl border ${
        locked ? "border-zinc-900 bg-black/60" : "border-zinc-800/80 bg-zinc-950/40"
      }`}
    >
      <div
        className={`flex items-center justify-between gap-2 border-b px-3 py-2.5 ${
          locked ? "border-zinc-900 bg-black/40" : `border-zinc-800/80 ${colors.bg}`
        }`}
      >
        <div className="flex items-center gap-2">
          <span className={`h-2 w-2 rounded-full ${colors.dot} ${locked ? "opacity-50" : ""}`} />
          <h3
            className={`text-xs font-semibold uppercase tracking-wide ${
              locked ? "text-zinc-500" : colors.text
            }`}
          >
            {STATUS_LABELS[status]}
          </h3>
          {locked && <Lock size={11} className="text-zinc-600" />}
        </div>
        <div className="flex items-center gap-1.5">
          <span className="rounded-md bg-zinc-900 px-1.5 py-0.5 text-[10px] font-medium text-zinc-400">
            {leads.length}
          </span>
          {!locked && (
            <button
              type="button"
              onClick={() => onCreate(status)}
              className={`rounded-md p-1 text-zinc-400 hover:bg-zinc-900 ${colors.text}`}
              title={`Criar lead em "${STATUS_LABELS[status]}"`}
              aria-label={`Criar lead em ${STATUS_LABELS[status]}`}
            >
              <Plus size={14} />
            </button>
          )}
        </div>
      </div>

      <div
        ref={setNodeRef}
        className={`no-scrollbar flex flex-1 flex-col gap-2 overflow-y-auto p-2 transition-colors ${
          locked ? "opacity-70" : ""
        } ${isOver && !locked ? "bg-zinc-800/30" : ""}`}
      >
        {leads.length === 0 && (
          <div className="flex flex-1 items-center justify-center py-8 text-center text-xs text-zinc-600">
            {locked ? "Etapa do Closer" : "Solte um lead aqui"}
          </div>
        )}
        {leads.map((lead) => (
          <LeadCard key={lead.id} lead={lead} onClick={() => onCardClick(lead)} onChangeFonte={onChangeFonte} />
        ))}
      </div>
    </div>
  );
}
