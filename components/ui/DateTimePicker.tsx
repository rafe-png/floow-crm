"use client";

import { useRef } from "react";
import { Calendar, Clock, X } from "lucide-react";

type Props = {
  date: string;       // 'YYYY-MM-DD' ou ''
  time: string;       // 'HH:MM' ou ''
  onDateChange: (v: string) => void;
  onTimeChange: (v: string) => void;
  showClear?: boolean;
};

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function formatBR(date: string, time: string): string {
  if (!date && !time) return "Sem data";
  if (date) {
    const [y, m, d] = date.split("-");
    const dt = `${d}/${m}/${y}`;
    return time ? `${dt} às ${time}` : dt;
  }
  return time;
}

/**
 * Componente combinado de data + hora com botão "calendário" visível.
 * Usa inputs nativos por baixo (suporte completo a teclado e picker).
 */
export function DateTimePicker({ date, time, onDateChange, onTimeChange, showClear }: Props) {
  const dateRef = useRef<HTMLInputElement>(null);
  const timeRef = useRef<HTMLInputElement>(null);

  function openDatePicker() {
    const el = dateRef.current;
    if (!el) return;
    if (typeof el.showPicker === "function") {
      try { el.showPicker(); return; } catch {}
    }
    el.focus();
  }

  function openTimePicker() {
    const el = timeRef.current;
    if (!el) return;
    if (typeof el.showPicker === "function") {
      try { el.showPicker(); return; } catch {}
    }
    el.focus();
  }

  return (
    <div className="space-y-2">
      {/* Visual amigável BR + botões */}
      <div
        onClick={openDatePicker}
        role="button"
        tabIndex={0}
        className="flex cursor-pointer items-center justify-between gap-2 rounded-md border border-zinc-800 bg-[#0f1218] px-3 py-2 text-sm hover:border-[#f5c518]/40 transition-colors"
      >
        <div className="flex items-center gap-2 min-w-0">
          <Calendar size={15} className="shrink-0 text-[#f5c518]" />
          <span className={date || time ? "text-zinc-100" : "text-zinc-500"}>
            {formatBR(date, time)}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); openTimePicker(); }}
            className="rounded p-1 text-zinc-400 hover:bg-zinc-900 hover:text-zinc-100"
            aria-label="Escolher hora"
          >
            <Clock size={14} />
          </button>
          {showClear && (date || time) && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onDateChange(""); onTimeChange(""); }}
              className="rounded p-1 text-zinc-500 hover:bg-rose-500/10 hover:text-rose-400"
              aria-label="Limpar data"
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Inputs nativos visíveis pra confirmar e permitir digitação direta */}
      <div className="grid grid-cols-2 gap-2">
        <div className="relative">
          <Calendar
            size={13}
            className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-500"
          />
          <input
            ref={dateRef}
            type="date"
            value={date}
            onChange={(e) => onDateChange(e.target.value)}
            min="1900-01-01"
            className="ds-date-input w-full rounded-md border border-zinc-800 bg-[#0f1218] py-2 pl-7 pr-2 text-sm text-zinc-100 outline-none focus:border-[#f5c518]"
            placeholder="dd/mm/aaaa"
          />
        </div>
        <div className="relative">
          <Clock
            size={13}
            className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-500"
          />
          <input
            ref={timeRef}
            type="time"
            value={time}
            onChange={(e) => onTimeChange(e.target.value)}
            className="ds-time-input w-full rounded-md border border-zinc-800 bg-[#0f1218] py-2 pl-7 pr-2 text-sm text-zinc-100 outline-none focus:border-[#f5c518]"
            placeholder="--:--"
          />
        </div>
      </div>

      <style jsx>{`
        .ds-date-input::-webkit-calendar-picker-indicator,
        .ds-time-input::-webkit-calendar-picker-indicator {
          filter: invert(0.6);
          cursor: pointer;
        }
      `}</style>
    </div>
  );
}

/**
 * Quebra um ISO timestamp em date (YYYY-MM-DD) e time (HH:MM) locais.
 */
export function splitIso(iso: string | null): { date: string; time: string } {
  if (!iso) return { date: "", time: "" };
  const d = new Date(iso);
  if (isNaN(d.getTime())) return { date: "", time: "" };
  const date = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const time = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  return { date, time };
}

/**
 * Junta date + time locais em ISO (UTC).
 */
export function joinIso(date: string, time: string): string | null {
  if (!date || !time) return null;
  const local = new Date(`${date}T${time}:00`);
  if (isNaN(local.getTime())) return null;
  return local.toISOString();
}
