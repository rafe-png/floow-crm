"use client";

import { CARGO_OPTIONS } from "@/lib/types";

type Props = {
  value: string | null;
  onChange: (v: string | null) => void;
};

export function CargoSelect({ value, onChange }: Props) {
  return (
    <div className="flex flex-wrap gap-1.5">
      <button
        type="button"
        onClick={() => onChange(null)}
        className={`rounded-md border px-3 py-1.5 text-xs font-medium transition-colors ${
          value === null
            ? "border-zinc-700 bg-zinc-800 text-zinc-300"
            : "border-zinc-800 bg-zinc-900 text-zinc-500 hover:border-zinc-700"
        }`}
      >
        —
      </button>
      {CARGO_OPTIONS.map((opt) => {
        const selected = opt === value;
        return (
          <button
            key={opt}
            type="button"
            onClick={() => onChange(opt)}
            className={`rounded-md border px-3 py-1.5 text-xs font-medium transition-colors ${
              selected
                ? "border-[#f5c518]/50 bg-[#f5c518]/15 text-[#f5c518]"
                : "border-zinc-800 bg-zinc-900 text-zinc-400 hover:border-zinc-700"
            }`}
          >
            {opt}
          </button>
        );
      })}
    </div>
  );
}
