"use client";

import { CIDADE_ALVO, ESTADO_OPTIONS, UF_LABELS, ufForCidade } from "@/lib/types";

type Props = {
  cidade: string | null;
  estado: string | null;
  onChange: (v: { cidade: string | null; estado: string | null }) => void;
};

const OUTRA = "__outra__";

// Seletor de cidade: lista as cidades-alvo (cada uma já com sua UF) + "Outra…".
// Ao escolher "Outra", libera um texto livre de cidade + seletor de UF.
export function CidadeSelect({ cidade, estado, onChange }: Props) {
  const isPreset = !!cidade && CIDADE_ALVO.some((c) => c.cidade.toLowerCase() === cidade.toLowerCase());
  const selectValue = !cidade ? "" : isPreset ? cidade : OUTRA;

  function handleSelect(value: string) {
    if (value === "") return onChange({ cidade: null, estado: null });
    if (value === OUTRA) return onChange({ cidade: "", estado: estado ?? null });
    // cidade-alvo → puxa a UF certa automaticamente
    onChange({ cidade: value, estado: ufForCidade(value) });
  }

  return (
    <div className="space-y-2">
      <select
        value={selectValue}
        onChange={(e) => handleSelect(e.target.value)}
        className="w-full rounded-md border border-zinc-800 bg-[#0f1218] px-3 py-2 text-sm text-zinc-100 outline-none focus:border-[#f5c518]"
      >
        <option value="">Selecione a cidade…</option>
        {CIDADE_ALVO.map((c) => (
          <option key={c.cidade} value={c.cidade}>
            {c.cidade} — {c.uf}
          </option>
        ))}
        <option value={OUTRA}>Outra cidade…</option>
      </select>

      {selectValue === OUTRA && (
        <div className="flex gap-2">
          <input
            value={cidade ?? ""}
            onChange={(e) => onChange({ cidade: e.target.value, estado })}
            placeholder="Nome da cidade"
            className="flex-1 rounded-md border border-zinc-800 bg-[#0f1218] px-3 py-2 text-sm text-zinc-100 outline-none focus:border-[#f5c518]"
          />
          <select
            value={estado ?? ""}
            onChange={(e) => onChange({ cidade, estado: e.target.value || null })}
            className="w-28 rounded-md border border-zinc-800 bg-[#0f1218] px-2 py-2 text-sm text-zinc-100 outline-none focus:border-[#f5c518]"
          >
            <option value="">UF</option>
            {ESTADO_OPTIONS.map((uf) => (
              <option key={uf} value={uf} title={UF_LABELS[uf]}>
                {uf}
              </option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
}
