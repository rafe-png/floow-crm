"use client";

import { useState } from "react";
import { CalendarRange } from "lucide-react";
import { usePeriodContext } from "@/lib/contexts/PeriodContext";
import { PERIOD_PRESETS, PERIOD_PRESET_LABELS, type PeriodSelection } from "@/lib/reports";

// Seletor de período global: botões de atalho (hoje, ontem, 7/14/30 dias, tempo
// todo) + um intervalo personalizado (duas datas). Lê/escreve no PeriodContext,
// então mudar aqui atualiza todas as telas.
export function PeriodPicker() {
  const { period, setPeriod } = usePeriodContext();
  const [customOpen, setCustomOpen] = useState(period.kind === "custom");

  const today = new Date().toISOString().slice(0, 10);
  const [start, setStart] = useState(period.kind === "custom" ? period.start : today);
  const [end, setEnd] = useState(period.kind === "custom" ? period.end : today);

  function applyCustom() {
    if (!start || !end) return;
    const sel: PeriodSelection =
      start <= end
        ? { kind: "custom", start, end }
        : { kind: "custom", start: end, end: start }; // corrige se inverteram
    setPeriod(sel);
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-1">
        {PERIOD_PRESETS.map((p) => {
          const active = period.kind === "preset" && period.preset === p;
          return (
            <button
              key={p}
              onClick={() => { setCustomOpen(false); setPeriod({ kind: "preset", preset: p }); }}
              className={`rounded-md border px-3 py-1.5 text-xs transition-colors ${
                active
                  ? "border-[#f5c518]/40 bg-[#f5c518]/10 text-[#f5c518]"
                  : "border-zinc-800 bg-zinc-900 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200"
              }`}
            >
              {PERIOD_PRESET_LABELS[p]}
            </button>
          );
        })}

        <button
          onClick={() => setCustomOpen((v) => !v)}
          className={`flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs transition-colors ${
            period.kind === "custom"
              ? "border-[#f5c518]/40 bg-[#f5c518]/10 text-[#f5c518]"
              : "border-zinc-800 bg-zinc-900 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200"
          }`}
        >
          <CalendarRange size={13} />
          {period.kind === "custom" ? `${period.start} → ${period.end}` : "Personalizado"}
        </button>
      </div>

      {customOpen && (
        <div className="flex flex-wrap items-end gap-2 rounded-lg border border-zinc-800 bg-zinc-950/70 p-3">
          <label className="flex flex-col gap-1">
            <span className="text-[10px] font-medium uppercase tracking-wide text-zinc-500">De</span>
            <input
              type="date"
              value={start}
              max={end || today}
              onChange={(e) => setStart(e.target.value)}
              className="rounded-md border border-zinc-800 bg-[#0f1218] px-2 py-1.5 text-xs text-zinc-100 outline-none focus:border-[#f5c518] [color-scheme:dark]"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[10px] font-medium uppercase tracking-wide text-zinc-500">Até</span>
            <input
              type="date"
              value={end}
              min={start}
              max={today}
              onChange={(e) => setEnd(e.target.value)}
              className="rounded-md border border-zinc-800 bg-[#0f1218] px-2 py-1.5 text-xs text-zinc-100 outline-none focus:border-[#f5c518] [color-scheme:dark]"
            />
          </label>
          <button
            onClick={applyCustom}
            className="rounded-md bg-[#f5c518] px-3 py-1.5 text-xs font-semibold text-zinc-950 hover:bg-[#ffd633]"
          >
            Aplicar
          </button>
        </div>
      )}
    </div>
  );
}
