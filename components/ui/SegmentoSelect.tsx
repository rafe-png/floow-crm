"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, Shirt } from "lucide-react";
import { SEGMENTO_LABELS, SEGMENTO_OPTIONS, type SegmentoConfeccao } from "@/lib/types";

type Props = {
  value: SegmentoConfeccao | null;
  onChange: (v: SegmentoConfeccao | null) => void;
};

export function SegmentoSelect({ value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 rounded-md border border-zinc-800 bg-[#0f1218] px-3 py-2 text-sm text-zinc-100 outline-none hover:border-[#f5c518]/40 focus:border-[#f5c518]"
      >
        <span className="flex items-center gap-2 min-w-0">
          <Shirt size={14} className="shrink-0 text-[#f5c518]" />
          <span className={value ? "text-zinc-100" : "text-zinc-500"}>
            {value ? SEGMENTO_LABELS[value] : "Selecionar segmento"}
          </span>
        </span>
        <ChevronDown size={15} className={`shrink-0 text-zinc-500 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute z-50 mt-1 max-h-64 w-full overflow-y-auto rounded-md border border-zinc-800 bg-zinc-950 p-1 shadow-2xl">
          {value && (
            <button
              type="button"
              onClick={() => { onChange(null); setOpen(false); }}
              className="flex w-full items-center rounded px-2.5 py-1.5 text-left text-xs text-zinc-500 hover:bg-zinc-900"
            >
              Limpar seleção
            </button>
          )}
          {SEGMENTO_OPTIONS.map((opt) => {
            const selected = opt === value;
            return (
              <button
                key={opt}
                type="button"
                onClick={() => { onChange(opt); setOpen(false); }}
                className={`flex w-full items-center justify-between gap-2 rounded px-2.5 py-1.5 text-left text-sm ${
                  selected ? "bg-[#f5c518]/15 text-[#f5c518]" : "text-zinc-200 hover:bg-zinc-900"
                }`}
              >
                {SEGMENTO_LABELS[opt]}
                {selected && <Check size={14} />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
