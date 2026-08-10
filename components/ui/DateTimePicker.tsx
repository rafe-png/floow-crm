"use client";

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

// Reuniões têm 1h de duração. Slots de 15 em 15 minutos, 07:00 → 20:45.
const SLOT_START_MIN = 7 * 60;
const SLOT_END_MIN = 20 * 60 + 45;
const SLOT_STEP_MIN = 15;
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

// Trava o próprio horário e a 1h seguinte (5 slots de 15 min, +60 inclusive).
// Ex.: reunião às 15:15 ocupa 15:15, 15:30, 15:45, 16:00 e 16:15 (livre a partir
// das 16:30). Não trava nada pra trás.
function overlapsBusy(slotMin: number, busyStarts: number[]): boolean {
  return busyStarts.some((b) => slotMin >= b && slotMin <= b + MEETING_DURATION_MIN);
}

/**
 * Data (1 input) + horário (1 seletor rolável de 15 em 15 min).
 * Seleciona apenas o início; a reunião sempre dura 1h e reserva a 1h seguinte.
 * Horários que conflitam com reuniões já marcadas no dia ficam desabilitados.
 */
export function DateTimePicker({
  date,
  time,
  onDateChange,
  onTimeChange,
  showClear,
  busyStarts = [],
}: Props) {
  const selectedMin = time ? hhmmToMinutes(time) : null;

  return (
    <div className="space-y-2">
      {/* Data — único input */}
      <div>
        <div className="mb-1 text-[11px] text-zinc-500">Data</div>
        <div className="relative">
          <Calendar
            size={13}
            className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-500"
          />
          <input
            type="date"
            value={date}
            onChange={(e) => onDateChange(e.target.value)}
            min="1900-01-01"
            className="ds-date-input w-full rounded-md border border-zinc-800 bg-[#0f1218] py-2 pl-7 pr-2 text-sm text-zinc-100 outline-none focus:border-[#f5c518]"
            placeholder="dd/mm/aaaa"
          />
        </div>
      </div>

      {/* Horário — seletor rolável de 15 em 15 min */}
      <div>
        <div className="mb-1 flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-[11px] text-zinc-500">
            <Clock size={12} />
            {date ? "Início — dura 1h (reserva a 1h seguinte)" : "Escolha a data primeiro"}
          </span>
          {showClear && (date || time) && (
            <button
              type="button"
              onClick={() => { onDateChange(""); onTimeChange(""); }}
              className="flex items-center gap-0.5 text-[11px] text-zinc-500 hover:text-rose-400"
            >
              <X size={11} /> limpar
            </button>
          )}
        </div>

        {!date ? (
          <div className="rounded-md border border-zinc-900 bg-zinc-950 px-3 py-3 text-center text-xs text-zinc-600">
            Selecione a data para liberar os horários
          </div>
        ) : (
          <div className="max-h-52 space-y-0.5 overflow-y-auto rounded-md border border-zinc-800 bg-[#0f1218] p-1">
            {SLOTS.map((m) => {
              const label = minutesToHHMM(m);
              const busy = overlapsBusy(m, busyStarts);
              const selected = selectedMin === m;

              let cls: string;
              if (selected) {
                cls = "bg-[#f5c518]/15 text-[#f5c518] font-semibold";
              } else if (busy) {
                cls = "cursor-not-allowed text-zinc-700 line-through";
              } else {
                cls = "text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100";
              }

              return (
                <button
                  key={m}
                  type="button"
                  disabled={busy}
                  onClick={() => onTimeChange(label)}
                  title={busy ? "Horário ocupado (reunião na 1h)" : label}
                  className={`flex w-full items-center justify-between rounded px-3 py-1.5 text-sm tabular-nums transition-colors ${cls}`}
                >
                  <span>{label}</span>
                  {busy && <span className="text-[10px] not-italic no-underline">ocupado</span>}
                  {selected && <span className="text-[10px]">✓</span>}
                </button>
              );
            })}
          </div>
        )}
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
