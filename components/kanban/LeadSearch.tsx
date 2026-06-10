"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Search, X } from "lucide-react";
import { STATUS_COLORS, STATUS_LABELS, type Lead } from "@/lib/types";

type Props = {
  leads: Lead[];
  onSelect: (lead: Lead) => void;
};

// Normaliza pra busca: minúsculas + sem acento.
function norm(s: string | null | undefined): string {
  return (s ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

const MAX_RESULTS = 8;

export function LeadSearch({ leads, onSelect }: Props) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const term = norm(query.trim());

  const matches = useMemo(() => {
    if (!term) return [];
    return leads
      .filter((l) => {
        const haystack = norm(
          [l.nome, l.empresa, l.telefone, l.instagram].filter(Boolean).join(" "),
        );
        return haystack.includes(term);
      })
      .slice(0, MAX_RESULTS);
  }, [leads, term]);

  // Item ativo nunca pode passar dos resultados atuais (sem useEffect — React 19).
  const activeIndex = Math.min(active, Math.max(matches.length - 1, 0));

  // Fecha ao clicar fora.
  useEffect(() => {
    function onPointer(e: PointerEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("pointerdown", onPointer);
    return () => document.removeEventListener("pointerdown", onPointer);
  }, []);

  function choose(lead: Lead) {
    onSelect(lead);
    setQuery("");
    setOpen(false);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (!open || matches.length === 0) {
      if (e.key === "Escape") setQuery("");
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, matches.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const lead = matches[activeIndex];
      if (lead) choose(lead);
    } else if (e.key === "Escape") {
      e.preventDefault();
      setQuery("");
      setOpen(false);
    }
  }

  const showDropdown = open && term.length > 0;

  return (
    <div ref={containerRef} className="relative w-full max-w-md">
      <div className="flex items-center gap-2 rounded-md border border-zinc-800 bg-zinc-900 px-2.5 py-1.5 focus-within:border-[#f5c518]">
        <Search size={14} className="shrink-0 text-zinc-500" />
        <input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setActive(0);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder="Pesquisar lead por nome, empresa, telefone…"
          className="flex-1 bg-transparent text-xs text-zinc-200 placeholder:text-zinc-600 outline-none"
        />
        {query && (
          <button
            type="button"
            onClick={() => {
              setQuery("");
              setOpen(false);
            }}
            className="shrink-0 text-zinc-500 hover:text-zinc-300"
            aria-label="Limpar busca"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {showDropdown && (
        <div className="absolute z-50 mt-1 w-full overflow-hidden rounded-md border border-zinc-800 bg-zinc-950 shadow-2xl">
          {matches.length === 0 ? (
            <div className="px-3 py-3 text-xs text-zinc-500">
              Nenhum lead encontrado para “{query.trim()}”.
            </div>
          ) : (
            <ul className="max-h-80 overflow-y-auto py-1">
              {matches.map((lead, i) => {
                const c = STATUS_COLORS[lead.status];
                return (
                  <li key={lead.id}>
                    <button
                      type="button"
                      onMouseEnter={() => setActive(i)}
                      onClick={() => choose(lead)}
                      className={`flex w-full items-center gap-2 px-3 py-2 text-left ${
                        i === activeIndex ? "bg-zinc-800/60" : "hover:bg-zinc-900"
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm text-zinc-100">
                          {lead.empresa || lead.nome}
                        </div>
                        <div className="truncate text-[11px] text-zinc-500">
                          {lead.empresa ? lead.nome : lead.telefone}
                          {lead.instagram ? ` · @${lead.instagram}` : ""}
                        </div>
                      </div>
                      <span
                        className={`flex shrink-0 items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-semibold ${c.bg} ${c.text} ${c.border}`}
                      >
                        <span className={`h-1.5 w-1.5 rounded-full ${c.dot}`} />
                        {STATUS_LABELS[lead.status]}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
