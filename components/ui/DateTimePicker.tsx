"use client";

import { useRef } from "react";
import { Calendar, Clock, X } from "lucide-react";
import type { Lead } from "@/lib/types";

type Props = {
  date: string;       // 'YYYY-MM-DD' ou ''
  time: string;       // 'HH:MM' ou ''
  onDateChange: (v: string) => void;
  onTimeChange: (v: string) => void;
  showClear?: boolean;
  /** Minutos-do-dia (ex.: 510 = 08:30) das reuniões já marcadas NESTA data. */
  busyStarts?: number[];
};

// Reuniões têm 1h de duração. Slots de 30 em 30 minutos, 07:00 → 20:30.
const SLOT_START_MIN = 7 * 60;
const SLOT_END_MIN = 20 * 60 + 30;
const SLOT_STEP_MIN = 30;
const MEETING_DURATION_MIN = 60;

const SLOTS: number[] = (() => {
  const arr: number[] = [];
  for (let m = SLOT_START_MIN; m <= SLOT_END_MIN; m += SLOT_STEP_MIN) arr.push(m);
  return arr;
})();

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function minutesToHHMM(m: number) {
  return `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
}

function hhmmToMinutes(t: string): number | null {
  const [h, m] = t.split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  return h * 60 + m;
}

// Trava o próprio horário e os 2 seguintes (+30 e +60 min).
// Ex.: reunião às 08:00 ocupa 08:00, 08:30 e 09:00 (não trava nada pra trás).
function overlapsBusy(slotMin: number, busyStarts: number[]): boolean {
  return busyStarts.some((b) => slotMin >= b && slotMin <= b + MEETING_DURATION_MIN);
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
 * Data (input nativo) + grade de horários de 30 min.
 * Seleciona apenas o início; a reunião sempre dura 1h. Horários que conflitam
 * com reuniões já marcadas no dia ficam desabilitados ("preenchidos").
 */
export function DateTimePicker({
  date,
  time,
  onDateChange,
  onTimeChange,
  showClear,
  busyStarts = [],
}: Props) {
  const dateRef = useRef<HTMLInputElement>(null);
  const selectedMin = time ? hhmmToMinutes(time) : null;

  function openDatePicker() {
    const el = dateRef.current;
    if (!el) return;
    if (typeof el.showPicker === "function") {
      try { el.showPicker(); return; } catch {}
    }
    el.focus();
  }

  return (
    <div className="space-y-2">
      {/* Resumo amigável BR */}
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

      {/* Input nativo de data */}
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

      {/* Grade de horários (30 min) */}
      <div>
        <div className="mb-1.5 flex items-center gap-1.5 text-[11px] text-zinc-500">
          <Clock size={12} />
          {date
            ? "Início da reunião — dura 1h"
            : "Selecione a data para liberar os horários"}
        </div>
        <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-5">
          {SLOTS.map((m) => {
            const label = minutesToHHMM(m);
            const busy = overlapsBusy(m, busyStarts);
            const disabled = !date || busy;
            const selected = selectedMin === m;

            let cls: string;
            if (selected) {
              cls = "border-[#f5c518] bg-[#f5c518]/15 text-[#f5c518] font-semibold";
            } else if (busy) {
              cls = "cursor-not-allowed border-zinc-900 bg-zinc-950 text-zinc-700 line-through";
            } else if (!date) {
              cls = "cursor-not-allowed border-zinc-900 bg-zinc-950 text-zinc-700";
            } else {
              cls = "border-zinc-800 bg-zinc-900 text-zinc-300 hover:border-[#f5c518]/50 hover:text-zinc-100";
            }

            return (
              <button
                key={m}
                type="button"
                disabled={disabled}
                onClick={() => onTimeChange(label)}
                title={busy ? "Horário ocupado" : label}
                className={`rounded-md border px-2 py-1.5 text-xs transition-colors ${cls}`}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      <style jsx>{`
        .ds-date-input::-webkit-calendar-picker-indicator {
          filter: invert(0.6);
          cursor: pointer;
        }
      `}</style>
    </div>
  );
}

/**
 * Minutos-do-dia das reuniões já marcadas em `dateStr` (YYYY-MM-DD).
 * Ignora o lead `excludeId` (ao editar) e leads com negócio perdido.
 */
export function busyStartsForDate(
  leads: Lead[],
  dateStr: string,
  excludeId?: string,
): number[] {
  if (!dateStr) return [];
  const out: number[] = [];
  for (const l of leads) {
    if (!l.data_agendamento) continue;
    if (excludeId && l.id === excludeId) continue;
    if (l.status === "negocio_perdido") continue;
    const d = new Date(l.data_agendamento);
    if (isNaN(d.getTime())) continue;
    const localDate = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    if (localDate !== dateStr) continue;
    out.push(d.getHours() * 60 + d.getMinutes());
  }
  return out;
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
