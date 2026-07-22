"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AudioLines, Check, Loader2, Trash2, Upload, X } from "lucide-react";
import { TopBar } from "@/components/layout/TopBar";
import { useTeamContext } from "@/lib/contexts/TeamContext";
import { getSupabase } from "@/lib/supabase/client";

type Snippet = {
  id: string;
  name: string;
  emoji: string | null;
  owner: string | null;
  urls: string[];
  active: boolean;
  ordem: number;
};

const EMOJI_PICKS = ["🌅", "☀️", "🌙", "👋", "💬", "🎤", "🔥", "✨"];

export default function AudiosPage() {
  const { isAdmin, members } = useTeamContext();

  const [snippets, setSnippets] = useState<Snippet[]>([]);
  const [loading, setLoading] = useState(true);

  // form
  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState("🎤");
  const [owner, setOwner] = useState<string>(""); // "" = Todos
  const [files, setFiles] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);

  // Donos possíveis: Todos + cada pessoa que usa a extensão (SDR/Closer), sem repetir nome.
  const ownerOptions = useMemo(() => {
    const names = members
      .filter((m) => m.active && (m.role === "SDR" || m.role === "Closer") && m.name)
      .map((m) => m.name);
    return Array.from(new Set(names));
  }, [members]);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await getSupabase()
      .from("audio_snippets")
      .select("id,name,emoji,owner,urls,active,ordem")
      .order("owner", { nullsFirst: true })
      .order("ordem");
    setSnippets((data as Snippet[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function pickFiles(list: FileList | null) {
    if (!list) return;
    const arr = Array.from(list).slice(0, 3); // no máximo 3 variantes
    setFiles(arr);
  }

  async function handleSave() {
    setError(null);
    setOkMsg(null);
    if (!name.trim()) return setError("Dá um nome pro áudio (ex: Abordagem — bom dia).");
    if (files.length === 0) return setError("Selecione de 1 a 3 arquivos de áudio.");

    setSaving(true);
    try {
      const supa = getSupabase();
      const folder = (owner || "todos").toLowerCase().replace(/[^a-z0-9]+/g, "-");
      const urls: string[] = [];
      for (const file of files) {
        const ext = (file.name.split(".").pop() || "ogg").toLowerCase();
        const path = `${folder}/${crypto.randomUUID()}.${ext}`;
        const up = await supa.storage.from("audios").upload(path, file, {
          contentType: file.type || "audio/ogg",
          upsert: false,
        });
        if (up.error) throw new Error("Falha no upload: " + up.error.message);
        const { data: pub } = supa.storage.from("audios").getPublicUrl(path);
        urls.push(pub.publicUrl);
      }

      const res = await fetch("/api/audios/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), emoji, owner: owner || null, urls }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || "Erro ao salvar.");

      setOkMsg(`Áudio "${name.trim()}" salvo com ${urls.length} variante(s).`);
      setName("");
      setFiles([]);
      setEmoji("🎤");
      setOwner("");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro inesperado.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(s: Snippet) {
    if (!confirm(`Excluir o áudio "${s.name}"? Isso apaga as ${s.urls.length} variante(s).`)) return;
    const res = await fetch("/api/audios/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: s.id }),
    });
    if (res.ok) setSnippets((prev) => prev.filter((x) => x.id !== s.id));
    else alert("Erro ao excluir.");
  }

  if (!isAdmin) {
    return (
      <>
        <TopBar title="Áudios" />
        <main className="flex-1 overflow-y-auto px-4 py-6 sm:px-6">
          <div className="mx-auto max-w-2xl rounded-xl border border-white/10 bg-white/[0.03] p-6 text-sm text-neutral-400">
            Só o administrador gerencia a biblioteca de áudios.
          </div>
        </main>
      </>
    );
  }

  const ownerLabel = (o: string | null) => (o ? o : "Todos");
  const grouped = groupByOwner(snippets);

  return (
    <>
      <TopBar title="Áudios" />
      <main className="flex-1 overflow-y-auto px-4 py-6 sm:px-6">
        <div className="mx-auto max-w-2xl space-y-6">
          {/* ---- Novo áudio ---- */}
          <section className="rounded-xl border border-white/10 bg-white/[0.03] p-5">
            <div className="mb-4 flex items-center gap-2">
              <AudioLines className="h-5 w-5 text-[#f5c518]" />
              <h2 className="text-base font-semibold text-white">Novo áudio</h2>
            </div>

            <p className="mb-4 text-xs leading-relaxed text-neutral-400">
              Suba de <strong>1 a 3 variantes</strong> do mesmo áudio (mesma mensagem, gravada/velocidade
              um pouco diferente). A extensão manda uma variante aleatória a cada envio — assim não é o
              mesmo arquivo toda vez (mitiga o risco de bloqueio).
            </p>

            {/* nome */}
            <label className="mb-1 block text-xs font-medium text-neutral-300">Nome</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Abordagem — bom dia"
              className="mb-4 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-[#f5c518]/50"
            />

            {/* emoji */}
            <label className="mb-1 block text-xs font-medium text-neutral-300">Ícone</label>
            <div className="mb-4 flex flex-wrap gap-1.5">
              {EMOJI_PICKS.map((em) => (
                <button
                  key={em}
                  type="button"
                  onClick={() => setEmoji(em)}
                  className={`h-9 w-9 rounded-lg border text-lg ${
                    emoji === em ? "border-[#f5c518] bg-[#f5c518]/10" : "border-white/10 bg-black/40"
                  }`}
                >
                  {em}
                </button>
              ))}
            </div>

            {/* dono */}
            <label className="mb-1 block text-xs font-medium text-neutral-300">Aparece para</label>
            <select
              value={owner}
              onChange={(e) => setOwner(e.target.value)}
              className="mb-4 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-[#f5c518]/50"
            >
              <option value="">Todos</option>
              {ownerOptions.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>

            {/* arquivos */}
            <label className="mb-1 block text-xs font-medium text-neutral-300">
              Arquivos de áudio (até 3)
            </label>
            <label className="mb-2 flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-white/20 bg-black/40 px-3 py-4 text-sm text-neutral-300 hover:border-[#f5c518]/40">
              <Upload className="h-4 w-4" />
              Escolher arquivos (.ogg, .mp3, .m4a…)
              <input
                type="file"
                accept="audio/*"
                multiple
                className="hidden"
                onChange={(e) => pickFiles(e.target.files)}
              />
            </label>
            {files.length > 0 && (
              <ul className="mb-3 space-y-1">
                {files.map((f, i) => (
                  <li key={i} className="flex items-center justify-between rounded-md bg-white/5 px-2.5 py-1.5 text-xs text-neutral-300">
                    <span className="truncate">🎵 {f.name}</span>
                    <button
                      type="button"
                      onClick={() => setFiles((prev) => prev.filter((_, j) => j !== i))}
                      className="ml-2 text-neutral-500 hover:text-red-400"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {error && <div className="mb-3 rounded-md bg-red-500/10 px-3 py-2 text-xs text-red-400">{error}</div>}
            {okMsg && (
              <div className="mb-3 flex items-center gap-1.5 rounded-md bg-emerald-500/10 px-3 py-2 text-xs text-emerald-400">
                <Check className="h-3.5 w-3.5" /> {okMsg}
              </div>
            )}

            <button
              onClick={handleSave}
              disabled={saving}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#f5c518] px-4 py-2.5 text-sm font-semibold text-black hover:bg-[#ffd633] disabled:opacity-60"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              {saving ? "Salvando…" : "Salvar áudio"}
            </button>
          </section>

          {/* ---- Biblioteca ---- */}
          <section className="rounded-xl border border-white/10 bg-white/[0.03] p-5">
            <h2 className="mb-4 text-base font-semibold text-white">Biblioteca</h2>
            {loading ? (
              <div className="flex items-center gap-2 text-sm text-neutral-400">
                <Loader2 className="h-4 w-4 animate-spin" /> Carregando…
              </div>
            ) : snippets.length === 0 ? (
              <p className="text-sm text-neutral-400">Nenhum áudio ainda. Sobe o primeiro acima. 👆</p>
            ) : (
              <div className="space-y-5">
                {grouped.map(([o, list]) => (
                  <div key={o ?? "todos"}>
                    <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                      {ownerLabel(o)}
                    </div>
                    <ul className="space-y-2">
                      {list.map((s) => (
                        <li
                          key={s.id}
                          className="flex items-center justify-between rounded-lg border border-white/10 bg-black/30 px-3 py-2.5"
                        >
                          <div className="min-w-0">
                            <div className="truncate text-sm text-white">
                              {s.emoji ? s.emoji + " " : "🎤 "}
                              {s.name}
                            </div>
                            <div className="text-[11px] text-neutral-500">
                              {s.urls.length} variante{s.urls.length > 1 ? "s" : ""}
                            </div>
                          </div>
                          <button
                            onClick={() => handleDelete(s)}
                            className="ml-3 shrink-0 rounded-md p-1.5 text-neutral-500 hover:bg-red-500/10 hover:text-red-400"
                            title="Excluir"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </main>
    </>
  );
}

function groupByOwner(snippets: Snippet[]): [string | null, Snippet[]][] {
  const map = new Map<string | null, Snippet[]>();
  for (const s of snippets) {
    const key = s.owner ?? null;
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(s);
  }
  // "Todos" (null) primeiro
  return Array.from(map.entries()).sort((a, b) => {
    if (a[0] === null) return -1;
    if (b[0] === null) return 1;
    return a[0].localeCompare(b[0]);
  });
}
