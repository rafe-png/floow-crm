"use client";

import { useTeamContext } from "@/lib/contexts/TeamContext";
import type { Owner } from "@/lib/types";

type Props = {
  role: Owner;
  value: string | null;
  onChange: (v: string | null) => void;
  allowNone?: boolean;
};

export function PersonSelect({ role, value, onChange, allowNone = true }: Props) {
  const { sdrs, closers, loading } = useTeamContext();
  const list = role === "SDR" ? sdrs : closers;

  if (loading) {
    return <div className="text-xs text-zinc-600">Carregando time…</div>;
  }

  if (list.length === 0) {
    return (
      <div className="text-xs text-zinc-600">
        Nenhum {role} cadastrado.{" "}
        <span className="text-zinc-500">Adicione em team_members.</span>
      </div>
    );
  }

  const activeColor =
    role === "SDR"
      ? "border-sky-500/50 bg-sky-500/15 text-sky-200"
      : "border-fuchsia-500/50 bg-fuchsia-500/15 text-fuchsia-200";

  // Quando o time crescer (>4 membros) vira dropdown
  if (list.length > 4) {
    return (
      <select
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value || null)}
        className="w-full rounded-md border border-zinc-800 bg-[#0f1218] px-3 py-2 text-sm text-zinc-100 outline-none focus:border-[#f5c518]"
      >
        {allowNone && <option value="">— Sem responsável —</option>}
        {list.map((m) => (
          <option key={m.id} value={m.name}>
            {m.name}
          </option>
        ))}
      </select>
    );
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {allowNone && (
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
      )}
      {list.map((m) => {
        const selected = m.name === value;
        return (
          <button
            key={m.id}
            type="button"
            onClick={() => onChange(m.name)}
            className={`rounded-md border px-3 py-1.5 text-xs font-medium transition-colors ${
              selected
                ? activeColor
                : "border-zinc-800 bg-zinc-900 text-zinc-400 hover:border-zinc-700"
            }`}
          >
            {m.name}
          </button>
        );
      })}
    </div>
  );
}
