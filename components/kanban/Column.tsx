"use client";

import { useDroppable } from "@dnd-kit/core";
import { LeadCard } from "./LeadCard";
import { STATUS_COLORS, STATUS_LABELS, type Lead, type LeadStatus } from "@/lib/types";

type Props = {
  status: LeadStatus;
  leads: Lead[];
  onCardClick: (lead: Lead) => void;
};

export function Column({ status, leads, onCardClick }: Props) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  const colors = STATUS_COLORS[status];

  return (
    <div className="flex h-full w-[280px] shrink-0 flex-col rounded-xl border border-zinc-800/80 bg-zinc-950/40">
      <div className={`flex items-center justify-between gap-2 border-b border-zinc-800/80 px-3 py-2.5 ${colors.bg}`}>
        <div className="flex items-center gap-2">
          <span className={`h-2 w-2 rounded-full ${colors.dot}`} />
          <h3 className={`text-xs font-semibold uppercase tracking-wide ${colors.text}`}>
            {STATUS_LABELS[status]}
          </h3>
        </div>
        <span className="rounded-md bg-zinc-900 px-1.5 py-0.5 text-[10px] font-medium text-zinc-400">
          {leads.length}
        </span>
      </div>

      <div
        ref={setNodeRef}
        className={`flex flex-1 flex-col gap-2 overflow-y-auto p-2 transition-colors ${
          isOver ? "bg-zinc-800/30" : ""
        }`}
      >
        {leads.length === 0 && (
          <div className="flex flex-1 items-center justify-center py-8 text-xs text-zinc-600">
            Solte um lead aqui
          </div>
        )}
        {leads.map((lead) => (
          <LeadCard key={lead.id} lead={lead} onClick={() => onCardClick(lead)} />
        ))}
      </div>
    </div>
  );
}
