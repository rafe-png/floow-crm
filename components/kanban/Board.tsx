"use client";

import { useMemo, useState } from "react";
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { Column } from "./Column";
import { LeadCard } from "./LeadCard";
import { canMoveTo, STATUS_ORDER, type Lead, type LeadStatus, type Owner } from "@/lib/types";

type Props = {
  leads: Lead[];
  onMove: (id: string, status: LeadStatus) => Promise<void>;
  onCardClick: (lead: Lead) => void;
  onCreate: (status: LeadStatus) => void;
  viewerRole: Owner | null;
  isAdmin: boolean;
};

export function Board({ leads, onMove, onCardClick, onCreate, viewerRole, isAdmin }: Props) {
  const [activeLead, setActiveLead] = useState<Lead | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 6 } }),
  );

  const byStatus = useMemo(() => {
    const map: Record<LeadStatus, Lead[]> = {
      qualificado: [],
      em_agendamento: [],
      reuniao_agendada: [],
      no_show: [],
      follow_up: [],
      carteira: [],
      negocio_ganho: [],
      negocio_perdido: [],
    };
    for (const l of leads) map[l.status].push(l);
    return map;
  }, [leads]);

  function handleDragStart(e: DragStartEvent) {
    const lead = e.active.data.current?.lead as Lead | undefined;
    if (lead) setActiveLead(lead);
  }

  async function handleDragEnd(e: DragEndEvent) {
    setActiveLead(null);
    const { active, over } = e;
    if (!over) return;
    const lead = active.data.current?.lead as Lead | undefined;
    const newStatus = over.id as LeadStatus;
    if (!lead || lead.status === newStatus) return;
    // Trava: SDR não solta card nas etapas do Closer (depois de "reunião agendada").
    if (!canMoveTo(newStatus, { role: viewerRole, isAdmin })) return;
    try {
      await onMove(lead.id, newStatus);
    } catch (err) {
      console.error("Falha ao mover lead:", err);
    }
  }

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="kanban-scroll flex h-full gap-3 overflow-x-auto overflow-y-hidden px-4 pb-4 pt-3">
        {STATUS_ORDER.map((status) => (
          <Column
            key={status}
            status={status}
            leads={byStatus[status]}
            onCardClick={onCardClick}
            onCreate={onCreate}
            locked={!canMoveTo(status, { role: viewerRole, isAdmin })}
          />
        ))}
      </div>

      <DragOverlay>
        {activeLead ? (
          <div className="w-[260px] rotate-2">
            <LeadCard lead={activeLead} onClick={() => {}} />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
