"use client";

import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { format, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { AlertTriangle, Calendar, User } from "lucide-react";
import { InstagramIcon, WhatsAppIcon } from "@/components/icons/BrandIcons";
import { computeLeadScore, PRIORITY_LABELS, PRIORITY_META, PRIORITY_SHORT } from "@/lib/lead-score";
import {
  BANT_NEED_LABELS,
  BANT_TIMING_LABELS,
  ESTOQUE_LABELS,
  FONTE_LABELS,
  FONTE_OPTIONS,
  SEGMENTO_LABELS,
  type Lead,
  type LeadFonte,
  whatsappLink,
} from "@/lib/types";

type Props = {
  lead: Lead;
  onClick: () => void;
  onChangeFonte?: (id: string, fonte: LeadFonte) => void;
};

export function LeadCard({ lead, onClick, onChangeFonte }: Props) {
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

  // Prioridade (estrelas + alta/média/baixa) — só mostra se já tem qualificação.
  const score = computeLeadScore(lead);
  const prio = PRIORITY_META[score.priority];

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
      className="group cursor-grab active:cursor-grabbing select-none rounded-lg border border-zinc-800 bg-zinc-900/70 p-3 hover:border-zinc-700 hover:bg-zinc-900 transition-colors"
    >
      <div className="min-w-0">
        <h4 className="text-sm font-medium text-zinc-100 line-clamp-1">{primary}</h4>
        {secondary && (
          <div className="truncate text-[11px] text-zinc-500">{secondary}</div>
        )}
      </div>

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

      {/* Origem (fonte de marketing) — selecionável direto no card */}
      <div className="mt-2 flex items-center gap-1.5">
        <span className="text-[10px] text-zinc-500">Origem:</span>
        {onChangeFonte ? (
          <select
            value={lead.fonte ?? ""}
            onClick={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
            onChange={(e) => {
              e.stopPropagation();
              if (e.target.value) onChangeFonte(lead.id, e.target.value as LeadFonte);
            }}
            className="rounded border border-zinc-700 bg-zinc-900 px-1.5 py-0.5 text-[10px] font-medium text-zinc-200 outline-none focus:border-[#f5c518]"
          >
            <option value="" disabled>Selecionar…</option>
            {FONTE_OPTIONS.map((f) => (
              <option key={f} value={f}>{FONTE_LABELS[f]}</option>
            ))}
          </select>
        ) : (
          <span className="text-[10px] font-medium text-zinc-300">
            {lead.fonte ? FONTE_LABELS[lead.fonte] : "—"}
          </span>
        )}
      </div>

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
        <span className="truncate">
          {formatDistanceToNow(new Date(lead.updated_at), { locale: ptBR, addSuffix: true })}
        </span>

        <div className="flex shrink-0 items-center gap-0.5">
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
            target="_blank"
            rel="noopener noreferrer"
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
