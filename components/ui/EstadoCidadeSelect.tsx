"use client";

import { useMemo, useState } from "react";
import { ESTADO_OPTIONS, UF_LABELS } from "@/lib/types";
import cidadesData from "@/lib/data/cidades-br.json";

const CIDADES = cidadesData as Record<string, string[]>;

type Props = {
  estado: string | null;
  cidade: string | null;
  onChange: (v: { estado: string | null; cidade: string | null }) => void;
};

/**
 * Seleciona o ESTADO (UF) primeiro e depois a CIDADE exata (municípios reais do
 * IBGE daquele estado, com busca). Trocar o estado limpa a cidade.
 */
export function EstadoCidadeSelect({ estado, cidade, onChange }: Props) {
  const [query, setQuery] = useState(cidade ?? "");
  const [open, setOpen] = useState(false);

  const cidades = estado ? (CIDADES[estado] ?? []) : [];
  const filtered = useMemo(() => {
    if (!estado) return [];
    const q = query.trim().toLowerCase();
    const base = q ? cidades.filter((c) => c.toLowerCase().includes(q)) : cidades;
    return base.slice(0, 60);
  }, [cidades, query, estado]);

  return (
    <div className="space-y-2">
      {/* 1) Estado */}
      <select
        value={estado ?? ""}
        onChange={(e) => {
          const uf = e.target.value || null;
          setQuery("");
          setOpen(false);
          onChange({ estado: uf, cidade: null }); // troca de estado → limpa cidade
        }}
        className="w-full rounded-md border border-zinc-800 bg-[#0f1218] px-3 py-2 text-sm text-zinc-100 outline-none focus:border-[#f5c518]"
      >
        <option value="">Selecione o estado…</option>
        {ESTADO_OPTIONS.map((uf) => (
          <option key={uf} value={uf}>
            {uf} — {UF_LABELS[uf]}
          </option>
        ))}
      </select>

      {/* 2) Cidade (habilita após escolher o estado) */}
      {estado && (
        <div>
          <input
            value={query}
            onChange={(e) => { setQuery(e.target.value); setOpen(true); if (cidade) onChange({ estado, cidade: null }); }}
            onFocus={() => setOpen(true)}
            placeholder="Digite a cidade…"
            className="w-full rounded-md border border-zinc-800 bg-[#0f1218] px-3 py-2 text-sm text-zinc-100 outline-none focus:border-[#f5c518]"
          />
          {cidade && !open && (
            <div className="mt-1 text-[11px] text-emerald-400">✓ {cidade}</div>
          )}
          {open && (
            <div className="mt-1 max-h-48 space-y-0.5 overflow-y-auto rounded-md border border-zinc-800 bg-[#0f1218] p-1">
              {filtered.length === 0 ? (
                <div className="px-2 py-1.5 text-xs text-zinc-600">Nenhuma cidade encontrada.</div>
              ) : (
                filtered.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => { onChange({ estado, cidade: c }); setQuery(c); setOpen(false); }}
                    className={`block w-full rounded px-2 py-1.5 text-left text-sm ${
                      cidade === c ? "bg-[#f5c518]/15 text-[#f5c518]" : "text-zinc-300 hover:bg-zinc-800"
                    }`}
                  >
                    {c}
                  </button>
                ))
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
