"use client";

import { useState, type MouseEvent } from "react";
import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { format, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { AlertTriangle, Calendar, Loader2, Phone, Star, User } from "lucide-react";
import { InstagramIcon, WhatsAppIcon } from "@/components/icons/BrandIcons";
import { webphoneManager } from "@/lib/api4com/webphone";
import { useLeadsContext } from "@/lib/contexts/LeadsContext";
import { useCallCount, useCallTotal } from "@/lib/hooks/useCallCounts";
import { computeLeadScore, PRIORITY_LABELS, PRIORITY_META, PRIORITY_SHORT } from "@/lib/lead-score";
import { TouchDots } from "@/components/kanban/TouchDots";
import {
  BANT_NEED_LABELS,
  BANT_TIMING_LABELS,
  ESTOQUE_LABELS,
  isCadenceStage,
  origemLabel,
  MOTIVO_CARTEIRA_LABELS,
  MOTIVO_DESQUALIFICACAO_LABELS,
  MOTIVO_PERDA_LABELS,
  SEGMENTO_LABELS,
  leadTemperature,
  type Lead,
  whatsappLink,
  WHATSAPP_TAB,
} from "@/lib/types";

type Props = {
  lead: Lead;
  onClick: () => void;
};

export function LeadCard({ lead, onClick }: Props) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: lead.id,
    data: { lead },
  });

  const style = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.4 : 1,
  };

  const primary = lead.empresa || lead.nome;
  const secondary = lead.empresa ? lead.nome : null;

  // Motivo da etapa (mostrado no card quando desqualificado / perdido / carteira).
  const motivo =
    lead.status === "desqualificado" && lead.motivo_desqualificacao
      ? MOTIVO_DESQUALIFICACAO_LABELS[lead.motivo_desqualificacao]
      : lead.status === "negocio_perdido" && lead.motivo_perda
      ? MOTIVO_PERDA_LABELS[lead.motivo_perda]
      : lead.status === "carteira" && lead.motivo_carteira
      ? MOTIVO_CARTEIRA_LABELS[lead.motivo_carteira]
      : null;

  // Prioridade (estrelas + alta/média/baixa) — só mostra se já tem qualificação.
  const score = computeLeadScore(lead);
  const prio = PRIORITY_META[score.priority];

  // Temperatura do lead pela DATA DE ENTRADA no CRM — selo em todo card.
  const [nowMs] = useState(() => Date.now());
  const temp = leadTemperature(lead, nowMs);

  // Ligações feitas HOJE (rodapé) e no TOTAL do histórico (topo) pra esse lead.
  const callsToday = useCallCount(lead.id);
  const callsTotal = useCallTotal(lead.id);

  // Estrela de PRIORIDADE (manual) — sobe o lead pro topo da coluna. Toggle otimista
  // via contexto; stopPropagation pra não ativar o drag/abrir o card.
  const { updateLead } = useLeadsContext();
  const starred = !!lead.prioridade;
  async function toggleStar(e: MouseEvent) {
    e.stopPropagation();
    try { await updateLead(lead.id, { prioridade: !starred }); }
    catch (err) { console.error("Falha ao marcar prioridade:", err); }
  }

  // Botão de ligar por telefone (API4COM). O widget flutuante assume a ligação; aqui
  // só iniciamos (com spinner). stopPropagation pra não ativar o drag do card.
  const [calling, setCalling] = useState(false);
  async function handleCall(e: MouseEvent) {
    e.stopPropagation();
    if (calling) return;
    setCalling(true);
    try {
      await webphoneManager.placeCall({
        leadId: lead.id,
        phone: lead.telefone,
        label: lead.empresa || lead.nome || lead.telefone,
      });
    } catch { /* o widget do webphone mostra o status/erro */ }
    finally { setCalling(false); }
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      onClick={(e) => {
        if (!isDragging) {
          e.stopPropagation();
          onClick();
        }
      }}
      className={`group cursor-grab active:cursor-grabbing select-none rounded-lg border p-3 transition-colors ${
        starred
          ? "border-[#f5c518]/60 bg-[#f5c518]/[0.06] ring-1 ring-[#f5c518]/30 hover:border-[#f5c518]/80"
          : "border-zinc-800 bg-zinc-900/70 hover:border-zinc-700 hover:bg-zinc-900"
      }`}
    >
      <div className="min-w-0">
        <div className="flex items-center gap-1.5">
          <span
            title={`Temperatura: ${temp.label} · entrou no CRM há ${temp.days < 1 ? "menos de 1 dia" : `${Math.floor(temp.days)} dia(s)`}`}
            className={`inline-flex shrink-0 items-center gap-1 rounded-full border ${temp.border} bg-zinc-950/40 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide ${temp.text}`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${temp.dot}`} />
            {temp.label}
          </span>
          <h4 className="min-w-0 flex-1 truncate text-sm font-medium text-zinc-100">{primary}</h4>
          {callsTotal > 0 && (
            <span
              className="flex shrink-0 items-center gap-0.5 rounded bg-sky-500/10 px-1 py-0.5 text-[10px] font-semibold tabular-nums text-sky-300"
              title={`${callsTotal} ligação(ões) no total (histórico completo)`}
            >
              <Phone size={10} />
              {callsTotal}
            </span>
          )}
          <button
            type="button"
            onClick={toggleStar}
            onPointerDown={(e) => e.stopPropagation()}
            className={`shrink-0 rounded p-0.5 transition-colors ${
              starred ? "text-[#f5c518] hover:text-[#ffd633]" : "text-zinc-600 hover:text-[#f5c518]"
            }`}
            title={starred ? "Remover prioridade (estrela)" : "Marcar como prioridade — sobe pro topo"}
            aria-label={starred ? "Remover prioridade" : "Marcar prioridade"}
            aria-pressed={starred}
          >
            <Star size={15} fill={starred ? "currentColor" : "none"} />
          </button>
        </div>
        {secondary && (
          <div className="truncate text-[11px] text-zinc-500">{secondary}</div>
        )}
      </div>

      {/* Negócio ganho sem valor registrado — pendência do Closer. */}
      {lead.status === "negocio_ganho" && !lead.valor && (
        <div className="mt-2 flex items-center gap-1.5 rounded border border-amber-500/40 bg-amber-500/10 px-1.5 py-1 text-[10px] font-semibold text-amber-300">
          <AlertTriangle size={11} />
          <span>Valor da venda pendente</span>
        </div>
      )}

      {/* Alerta de no-shows seguidos: 2+ furos sem reunião acontecer entre eles. */}
      {lead.no_show_count >= 2 && (
        <div
          title={lead.last_no_show_em
            ? `Último no-show: ${format(new Date(lead.last_no_show_em), "d MMM · HH:mm", { locale: ptBR })}`
            : undefined}
          className="mt-2 flex items-center gap-1.5 rounded border border-rose-500/40 bg-rose-500/10 px-1.5 py-1 text-[10px] font-semibold text-rose-300"
        >
          <AlertTriangle size={11} />
          <span>{lead.no_show_count} no-shows seguidos</span>
        </div>
      )}

      {/* Motivo da etapa (desqualificado / perdido / carteira) */}
      {motivo && (
        <div className="mt-2 flex items-start gap-1.5 rounded border border-amber-500/30 bg-amber-500/10 px-1.5 py-1 text-[10px] font-medium text-amber-200">
          <AlertTriangle size={11} className="mt-px shrink-0 text-amber-400" />
          <span className="line-clamp-2">{motivo}</span>
        </div>
      )}

      {/* Prioridade — só da etapa "Qualificado" (em_agendamento) em diante,
          quando o lead já passou pela qualificação. Não aparece na Entrada. */}
      {lead.status !== "qualificado" && score.answered > 0 && (
        <div className="mt-2">
          <span
            title={`${PRIORITY_LABELS[score.priority]} · score ${score.score}/100 · ${score.answered}/${score.total} respostas`}
            className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] font-semibold ${prio.bg} ${prio.text} ${prio.border}`}
          >
            {prio.emoji} {PRIORITY_SHORT[score.priority]} · {score.stars}★
          </span>
        </div>
      )}

      {/* Badges de qualificação */}
      {(lead.segmento || lead.estoque || lead.bant_need || lead.bant_timing) && (
        <div className="mt-2 flex flex-wrap gap-1">
          {lead.segmento && (
            <span className="rounded bg-[#f5c518]/10 px-1.5 py-0.5 text-[10px] font-medium text-[#f5c518]">
              👕 {SEGMENTO_LABELS[lead.segmento]}
            </span>
          )}
          {lead.estoque && (
            <Badge label={`📦 ${ESTOQUE_LABELS[lead.estoque]}`} />
          )}
          {lead.bant_need && (
            <Badge label={`🔥 ${BANT_NEED_LABELS[lead.bant_need]}`} />
          )}
          {lead.bant_timing && (
            <Badge label={`⏱ ${BANT_TIMING_LABELS[lead.bant_timing]}`} />
          )}
        </div>
      )}

      {/* Data do agendamento */}
      {lead.data_agendamento && (
        <div className="mt-2 flex items-center gap-1.5 rounded bg-[#f5c518]/10 px-1.5 py-1 text-[11px] text-[#f5c518]">
          <Calendar size={11} />
          <span className="font-medium">
            {format(new Date(lead.data_agendamento), "d MMM · HH:mm", { locale: ptBR })}
          </span>
        </div>
      )}

      {/* Origem (canal real do lead; cai pra fonte) — só exibição; edição no modal */}
      {origemLabel(lead) && (
        <div className="mt-2 flex items-center gap-1.5 text-[10px] text-zinc-500">
          <span>Origem:</span>
          <span className="font-medium text-zinc-300">{origemLabel(lead)}</span>
        </div>
      )}

      {/* Responsáveis */}
      {(lead.sdr_responsavel || lead.closer_responsavel) && (
        <div className="mt-2 space-y-0.5 border-t border-zinc-800/60 pt-1.5">
          {lead.sdr_responsavel && (
            <div className="flex items-center gap-1 text-[10px] text-zinc-400">
              <User size={9} className="text-sky-400" />
              <span className="text-sky-300 font-medium">SDR:</span>
              <span className="truncate">{lead.sdr_responsavel}</span>
            </div>
          )}
          {lead.closer_responsavel && (
            <div className="flex items-center gap-1 text-[10px] text-zinc-400">
              <User size={9} className="text-fuchsia-400" />
              <span className="text-fuchsia-300 font-medium">Closer:</span>
              <span className="truncate">{lead.closer_responsavel}</span>
            </div>
          )}
        </div>
      )}

      {/* Valor */}
      {lead.valor != null && (
        <div className="mt-1.5 text-xs font-medium text-emerald-300">
          {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(Number(lead.valor))}
        </div>
      )}

      <div className="mt-2 flex items-center justify-between gap-1 text-[10px] text-zinc-500">
        <div className="flex min-w-0 items-center gap-1.5">
          <span className="truncate">
            {formatDistanceToNow(new Date(lead.updated_at), { locale: ptBR, addSuffix: true })}
          </span>
          {/* 3 bolinhas = os toques (ligações) de HOJE. Na zona de cadência
              (Entrada → Qualificado) cobra o toque que falta; fora dela só mostra. */}
          <TouchDots done={callsToday} active={isCadenceStage(lead.status)} />
        </div>

        <div className="flex shrink-0 items-center gap-0.5">
          <button
            type="button"
            onClick={handleCall}
            onPointerDown={(e) => e.stopPropagation()}
            disabled={calling}
            className="flex items-center rounded px-1.5 py-1 text-sky-400 hover:bg-sky-400/10 disabled:opacity-50"
            title={`Ligar por telefone ${lead.telefone}`}
          >
            {calling ? <Loader2 size={13} className="animate-spin" /> : <Phone size={13} />}
          </button>

          {lead.instagram && (
            <a
              href={`https://instagram.com/${lead.instagram}`}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              onPointerDown={(e) => e.stopPropagation()}
              className="flex items-center gap-1 rounded px-1.5 py-1 text-[#E1306C] hover:bg-[#E1306C]/10"
              title={`Instagram @${lead.instagram}`}
            >
              <InstagramIcon size={12} />
              <span className="text-[10px] font-medium">Instagram</span>
            </a>
          )}

          <a
            href={whatsappLink(lead.telefone)}
            target={WHATSAPP_TAB}
            onClick={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
            className="flex items-center gap-1 rounded px-1.5 py-1 text-[#25D366] hover:bg-[#25D366]/10"
            title={`WhatsApp ${lead.telefone}`}
          >
            <WhatsAppIcon size={12} />
            <span className="text-[10px] font-medium">WhatsApp</span>
          </a>
        </div>
      </div>
    </div>
  );
}

function Badge({ label }: { label: string }) {
  return (
    <span className="rounded bg-zinc-800/70 px-1.5 py-0.5 text-[10px] text-zinc-300">
      {label}
    </span>
  );
}
