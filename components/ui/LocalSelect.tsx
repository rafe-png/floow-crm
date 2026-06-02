"use client";

import { LOCAL_ICONS, LOCAL_LABELS, type LocalReuniao } from "@/lib/types";

type Props = {
  value: LocalReuniao | null;
  onChange: (v: LocalReuniao | null) => void;
};

export function LocalSelect({ value, onChange }: Props) {
  const options: LocalReuniao[] = ["online", "presencial"];

  return (
    <div className="flex gap-1.5">
      {options.map((opt) => {
        const selected = opt === value;
        const color =
          opt === "online"
            ? selected ? "border-cyan-500/50 bg-cyan-500/15 text-cyan-200" : "border-zinc-800 bg-zinc-900 text-zinc-400 hover:border-zinc-700"
            : selected ? "border-orange-500/50 bg-orange-500/15 text-orange-200" : "border-zinc-800 bg-zinc-900 text-zinc-400 hover:border-zinc-700";
        return (
          <button
            key={opt}
            type="button"
            onClick={() => onChange(selected ? null : opt)}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-md border px-3 py-2 text-xs font-medium transition-colors ${color}`}
          >
            <span>{LOCAL_ICONS[opt]}</span>
            <span>{LOCAL_LABELS[opt]}</span>
          </button>
        );
      })}
    </div>
  );
}
