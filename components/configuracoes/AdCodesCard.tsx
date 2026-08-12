"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, Plus, Trash2 } from "lucide-react";
import { getSupabase } from "@/lib/supabase/client";

type AdCode = { id: string; code: string; label: string | null; active: boolean; created_at: string };

export function AdCodesCard() {
  const [codes, setCodes] = useState<AdCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [code, setCode] = useState("");
  const [label, setLabel] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data } = await getSupabase()
      .from("ad_codes")
      .select("id, code, label, active, created_at")
      .order("created_at", { ascending: false });
    setCodes((data as AdCode[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    const ch = getSupabase()
      .channel("ad_codes-cfg")
      .on("postgres_changes", { event: "*", schema: "public", table: "ad_codes" }, () => load())
      .subscribe();
    return () => { getSupabase().removeChannel(ch); };
  }, [load]);

  async function handleAdd() {
    setError(null);
    const clean = code.trim().replace(/^\[|\]$/g, ""); // aceita com ou sem colchetes
    if (!clean) return setError("Digite o código do anúncio (ex: C1-25).");
    if (!/^[A-Za-z0-9][A-Za-z0-9-]{0,15}$/.test(clean)) {
      return setError("Use só letras, números e hífen (ex: 08, C1-25, 08V2).");
    }
    if (codes.some((c) => c.code.toUpperCase() === clean.toUpperCase())) {
      return setError("Esse código já está cadastrado.");
    }
    setSaving(true);
    const { error: e } = await getSupabase().from("ad_codes").insert({ code: clean, label: label.trim() || null });
    setSaving(false);
    if (e) return setError(e.message.includes("duplicate") ? "Código já cadastrado." : e.message);
    setCode(""); setLabel("");
  }

  async function toggle(c: AdCode) {
    await getSupabase().from("ad_codes").update({ active: !c.active }).eq("id", c.id);
  }
  async function remove(c: AdCode) {
    if (!confirm(`Excluir o código [${c.code}]? Leads futuros com ele deixam de entrar.`)) return;
    await getSupabase().from("ad_codes").delete().eq("id", c.id);
  }

  return (
    <section className="rounded-2xl border border-zinc-900 bg-zinc-950/60 p-5">
      <header className="mb-4">
        <h2 className="text-sm font-semibold text-zinc-100">Códigos de anúncio</h2>
        <p className="text-xs text-zinc-500">
          Só entram no CRM os leads cuja 1ª mensagem tem um código <strong>cadastrado</strong> entre colchetes
          (ex: <code>[C1-25]</code>). Cadastre o código de cada anúncio novo aqui.
        </p>
      </header>

      {/* Adicionar */}
      <div className="mb-4 flex flex-wrap items-end gap-2">
        <label className="flex-1">
          <span className="mb-1 block text-[11px] text-zinc-400">Código (sem colchetes)</span>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            placeholder="Ex: C1-25"
            className="w-full rounded-md border border-zinc-800 bg-[#0f1218] px-3 py-2 text-sm text-zinc-100 outline-none focus:border-[#f5c518]"
          />
        </label>
        <label className="flex-[1.4]">
          <span className="mb-1 block text-[11px] text-zinc-400">Descrição (opcional)</span>
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            placeholder="Ex: Vídeo depoimento — tarde"
            className="w-full rounded-md border border-zinc-800 bg-[#0f1218] px-3 py-2 text-sm text-zinc-100 outline-none focus:border-[#f5c518]"
          />
        </label>
        <button
          onClick={handleAdd}
          disabled={saving}
          className="flex items-center gap-1.5 rounded-md bg-[#f5c518] px-3 py-2 text-sm font-semibold text-black hover:bg-[#ffd633] disabled:opacity-60"
        >
          <Plus size={14} /> Adicionar
        </button>
      </div>
      {error && <div className="mb-3 rounded-md bg-rose-500/10 px-3 py-2 text-xs text-rose-400">{error}</div>}

      {/* Lista */}
      {loading ? (
        <p className="text-xs text-zinc-500">Carregando…</p>
      ) : codes.length === 0 ? (
        <p className="text-xs text-zinc-500">Nenhum código cadastrado ainda.</p>
      ) : (
        <ul className="space-y-1.5">
          {codes.map((c) => (
            <li key={c.id} className="flex items-center gap-2 rounded-lg border border-zinc-800 bg-black/30 px-3 py-2">
              <span className={`font-mono text-sm font-semibold ${c.active ? "text-[#f5c518]" : "text-zinc-600 line-through"}`}>
                [{c.code}]
              </span>
              {c.label && <span className="min-w-0 flex-1 truncate text-xs text-zinc-400">{c.label}</span>}
              <button
                onClick={() => toggle(c)}
                className={`ml-auto rounded px-2 py-1 text-[11px] font-medium ${
                  c.active ? "bg-emerald-500/10 text-emerald-300" : "bg-zinc-800 text-zinc-400"
                }`}
                title={c.active ? "Ativo — clique para pausar" : "Pausado — clique para ativar"}
              >
                {c.active ? <span className="flex items-center gap-1"><Check size={11} /> Ativo</span> : "Pausado"}
              </button>
              <button
                onClick={() => remove(c)}
                className="rounded p-1.5 text-zinc-500 hover:bg-rose-500/10 hover:text-rose-400"
                title="Excluir"
              >
                <Trash2 size={14} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
