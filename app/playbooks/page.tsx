"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Bold, Check, ChevronDown, ChevronUp, Eye, Italic, List, ListChecks,
  Plus, Quote, Save, Trash2, X, Heading, Minus, BookOpen,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { TopBar } from "@/components/layout/TopBar";
import { Markdown } from "@/components/playbooks/Markdown";
import { useTeamContext } from "@/lib/contexts/TeamContext";
import { getSupabase } from "@/lib/supabase/client";
import type { Playbook } from "@/lib/types";

export default function PlaybooksPage() {
  const { isAdmin, currentMember } = useTeamContext();
  const [items, setItems] = useState<Playbook[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [preview, setPreview] = useState(false);

  // Campos em edição.
  const [fTitle, setFTitle] = useState("");
  const [fEmoji, setFEmoji] = useState("");
  const [fCat, setFCat] = useState("");
  const [fBody, setFBody] = useState("");
  const [saving, setSaving] = useState(false);
  const taRef = useRef<HTMLTextAreaElement>(null);

  const load = useCallback(async () => {
    const { data } = await getSupabase()
      .from("playbooks")
      .select("*")
      .order("categoria", { nullsFirst: true })
      .order("ordem");
    const list = (data as Playbook[]) ?? [];
    setItems(list);
    setLoading(false);
    setSelectedId((cur) => cur ?? list[0]?.id ?? null);
  }, []);

  useEffect(() => {
    load();
    const ch = getSupabase()
      .channel("playbooks-page")
      .on("postgres_changes", { event: "*", schema: "public", table: "playbooks" }, () => { if (!editing) load(); })
      .subscribe();
    return () => { getSupabase().removeChannel(ch); };
  }, [load, editing]);

  const selected = useMemo(() => items.find((p) => p.id === selectedId) ?? null, [items, selectedId]);

  // Agrupado por categoria (mantém a ordem de inserção das categorias).
  const groups = useMemo(() => {
    const map = new Map<string, Playbook[]>();
    for (const p of items) {
      const k = p.categoria || "Geral";
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(p);
    }
    return Array.from(map.entries());
  }, [items]);

  function startEdit(p: Playbook) {
    setFTitle(p.title); setFEmoji(p.emoji ?? ""); setFCat(p.categoria ?? ""); setFBody(p.conteudo);
    setEditing(true); setPreview(false);
  }

  async function handleSave() {
    if (!selected) return;
    if (!fTitle.trim()) return;
    setSaving(true);
    const patch = {
      title: fTitle.trim(), emoji: fEmoji.trim() || null, categoria: fCat.trim() || null,
      conteudo: fBody, updated_by: currentMember?.name ?? null,
    };
    const { error } = await getSupabase().from("playbooks").update(patch).eq("id", selected.id);
    setSaving(false);
    if (error) { alert("Erro ao salvar: " + error.message); return; }
    setEditing(false);
    load();
  }

  async function handleCreate() {
    const maxOrder = items.reduce((m, p) => Math.max(m, p.ordem), 0);
    const { data, error } = await getSupabase()
      .from("playbooks")
      .insert({ title: "Novo playbook", categoria: selected?.categoria ?? "Geral", conteudo: "", ordem: maxOrder + 1, updated_by: currentMember?.name ?? null })
      .select()
      .single();
    if (error) { alert("Erro: " + error.message); return; }
    const p = data as Playbook;
    setItems((prev) => [...prev, p]);
    setSelectedId(p.id);
    startEdit(p);
  }

  async function handleDelete(p: Playbook) {
    if (!confirm(`Excluir o playbook "${p.title}"?`)) return;
    await getSupabase().from("playbooks").delete().eq("id", p.id);
    setItems((prev) => prev.filter((x) => x.id !== p.id));
    if (selectedId === p.id) setSelectedId(null);
  }

  async function reorder(p: Playbook, dir: -1 | 1) {
    const sameCat = items.filter((x) => (x.categoria || "Geral") === (p.categoria || "Geral")).sort((a, b) => a.ordem - b.ordem);
    const idx = sameCat.findIndex((x) => x.id === p.id);
    const swap = sameCat[idx + dir];
    if (!swap) return;
    await getSupabase().from("playbooks").update({ ordem: swap.ordem }).eq("id", p.id);
    await getSupabase().from("playbooks").update({ ordem: p.ordem }).eq("id", swap.id);
    load();
  }

  // Toolbar do editor: insere markdown na posição do cursor.
  function wrap(before: string, after = before) {
    const ta = taRef.current; if (!ta) return;
    const s = ta.selectionStart, e = ta.selectionEnd;
    const sel = fBody.slice(s, e) || "texto";
    const next = fBody.slice(0, s) + before + sel + after + fBody.slice(e);
    setFBody(next);
    setTimeout(() => { ta.focus(); ta.selectionStart = s + before.length; ta.selectionEnd = s + before.length + sel.length; }, 0);
  }
  function linePrefix(prefix: string) {
    const ta = taRef.current; if (!ta) return;
    const s = ta.selectionStart;
    const lineStart = fBody.lastIndexOf("\n", s - 1) + 1;
    const next = fBody.slice(0, lineStart) + prefix + fBody.slice(lineStart);
    setFBody(next);
    setTimeout(() => { ta.focus(); ta.selectionStart = ta.selectionEnd = s + prefix.length; }, 0);
  }

  return (
    <>
      <TopBar title="Playbooks" />
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar de playbooks */}
        <aside className="flex w-60 shrink-0 flex-col border-r border-zinc-900 bg-zinc-950/40">
          <div className="flex items-center justify-between px-3 py-2.5">
            <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-zinc-500">
              <BookOpen size={13} /> Playbooks
            </span>
            {isAdmin && (
              <button onClick={handleCreate} title="Novo playbook" className="rounded-md p-1 text-zinc-400 hover:bg-zinc-900 hover:text-[#f5c518]">
                <Plus size={15} />
              </button>
            )}
          </div>
          <div className="flex-1 overflow-y-auto px-2 pb-4">
            {loading ? (
              <p className="px-2 text-xs text-zinc-600">Carregando…</p>
            ) : items.length === 0 ? (
              <p className="px-2 text-xs text-zinc-600">Nenhum playbook ainda.{isAdmin ? " Clique em +" : ""}</p>
            ) : (
              groups.map(([cat, arr]) => (
                <div key={cat} className="mb-3">
                  <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-600">{cat}</div>
                  {arr.map((p, i) => {
                    const active = p.id === selectedId;
                    return (
                      <div key={p.id} className={`group flex items-center gap-1 rounded-md ${active ? "bg-[#f5c518]/10" : "hover:bg-zinc-900"}`}>
                        <button
                          onClick={() => { setSelectedId(p.id); setEditing(false); }}
                          className={`flex min-w-0 flex-1 items-center gap-2 px-2 py-1.5 text-left text-sm ${active ? "text-[#f5c518]" : "text-zinc-300"}`}
                        >
                          <span className="shrink-0">{p.emoji || "📄"}</span>
                          <span className="truncate">{p.title}</span>
                        </button>
                        {isAdmin && (
                          <div className="flex shrink-0 items-center opacity-0 transition-opacity group-hover:opacity-100">
                            <button onClick={() => reorder(p, -1)} disabled={i === 0} title="Subir" className="p-0.5 text-zinc-600 hover:text-zinc-300 disabled:opacity-30"><ChevronUp size={13} /></button>
                            <button onClick={() => reorder(p, 1)} disabled={i === arr.length - 1} title="Descer" className="p-0.5 text-zinc-600 hover:text-zinc-300 disabled:opacity-30"><ChevronDown size={13} /></button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ))
            )}
          </div>
        </aside>

        {/* Conteúdo */}
        <main className="flex-1 overflow-y-auto">
          {!selected ? (
            <div className="flex h-full items-center justify-center p-8 text-center text-sm text-zinc-500">
              {items.length === 0 ? "Nenhum playbook ainda." : "Selecione um playbook à esquerda."}
            </div>
          ) : editing ? (
            /* ---- Editor (admin) ---- */
            <div className="mx-auto flex h-full max-w-5xl flex-col p-4 sm:p-6">
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <input value={fEmoji} onChange={(e) => setFEmoji(e.target.value)} placeholder="📄" maxLength={4}
                  className="w-14 rounded-md border border-zinc-800 bg-[#0f1218] px-2 py-2 text-center text-lg outline-none focus:border-[#f5c518]" />
                <input value={fTitle} onChange={(e) => setFTitle(e.target.value)} placeholder="Título do playbook"
                  className="min-w-0 flex-1 rounded-md border border-zinc-800 bg-[#0f1218] px-3 py-2 text-base font-semibold text-zinc-100 outline-none focus:border-[#f5c518]" />
                <input value={fCat} onChange={(e) => setFCat(e.target.value)} placeholder="Categoria"
                  className="w-40 rounded-md border border-zinc-800 bg-[#0f1218] px-3 py-2 text-sm text-zinc-300 outline-none focus:border-[#f5c518]" />
              </div>

              {/* Toolbar */}
              <div className="mb-1 flex flex-wrap items-center gap-1 rounded-t-md border border-zinc-800 bg-zinc-900/60 px-2 py-1.5">
                <TB title="Título (H2)" onClick={() => linePrefix("## ")}><Heading size={15} /></TB>
                <TB title="Subtítulo (H3)" onClick={() => linePrefix("### ")}><span className="text-xs font-bold">H3</span></TB>
                <span className="mx-1 h-4 w-px bg-zinc-800" />
                <TB title="Negrito" onClick={() => wrap("**")}><Bold size={15} /></TB>
                <TB title="Itálico" onClick={() => wrap("_")}><Italic size={15} /></TB>
                <span className="mx-1 h-4 w-px bg-zinc-800" />
                <TB title="Lista" onClick={() => linePrefix("- ")}><List size={15} /></TB>
                <TB title="Checklist" onClick={() => linePrefix("- [ ] ")}><ListChecks size={15} /></TB>
                <TB title="Citação/destaque" onClick={() => linePrefix("> ")}><Quote size={15} /></TB>
                <TB title="Divisória" onClick={() => linePrefix("\n---\n")}><Minus size={15} /></TB>
                <span className="ml-auto" />
                <TB title={preview ? "Editar" : "Prévia"} onClick={() => setPreview((v) => !v)}><Eye size={15} className={preview ? "text-[#f5c518]" : ""} /></TB>
              </div>

              <div className="flex min-h-0 flex-1 gap-3">
                {!preview && (
                  <textarea ref={taRef} value={fBody} onChange={(e) => setFBody(e.target.value)}
                    placeholder={"Escreva em Markdown…\n\n## Seção\n- item\n- [ ] tarefa\n\n> Dica importante"}
                    className="min-h-0 flex-1 resize-none rounded-b-md border border-t-0 border-zinc-800 bg-[#0f1218] p-4 font-mono text-sm leading-relaxed text-zinc-200 outline-none focus:border-[#f5c518]" />
                )}
                {preview && (
                  <div className="min-h-0 flex-1 overflow-y-auto rounded-b-md border border-t-0 border-zinc-800 bg-zinc-950/40 p-4">
                    <Markdown>{fBody}</Markdown>
                  </div>
                )}
              </div>

              <div className="mt-3 flex items-center justify-between">
                <button onClick={() => handleDelete(selected)} className="flex items-center gap-1.5 rounded-md border border-rose-500/30 px-3 py-1.5 text-xs text-rose-300 hover:bg-rose-500/10">
                  <Trash2 size={13} /> Excluir
                </button>
                <div className="flex gap-2">
                  <button onClick={() => setEditing(false)} className="flex items-center gap-1.5 rounded-md px-4 py-1.5 text-sm text-zinc-400 hover:text-zinc-200">
                    <X size={14} /> Cancelar
                  </button>
                  <button onClick={handleSave} disabled={saving} className="flex items-center gap-1.5 rounded-md bg-[#f5c518] px-4 py-1.5 text-sm font-semibold text-zinc-950 hover:bg-[#ffd633] disabled:opacity-50">
                    <Save size={14} /> {saving ? "Salvando…" : "Salvar"}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            /* ---- Leitura ---- */
            <article className="mx-auto max-w-3xl px-4 py-6 sm:px-8 sm:py-10">
              <div className="mb-1 flex items-start justify-between gap-3">
                <h1 className="flex items-center gap-3 text-3xl font-extrabold tracking-tight text-zinc-50">
                  <span>{selected.emoji || "📄"}</span> {selected.title}
                </h1>
                {isAdmin && (
                  <button onClick={() => startEdit(selected)} className="mt-1 flex shrink-0 items-center gap-1.5 rounded-md border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-xs text-zinc-300 hover:border-[#f5c518]/40 hover:text-[#f5c518]">
                    <Check size={13} /> Editar
                  </button>
                )}
              </div>
              <p className="mb-6 text-[11px] text-zinc-600">
                {selected.categoria ? `${selected.categoria} · ` : ""}
                atualizado {format(new Date(selected.updated_at), "d 'de' MMM 'às' HH:mm", { locale: ptBR })}
                {selected.updated_by ? ` por ${selected.updated_by}` : ""}
              </p>
              <Markdown>{selected.conteudo}</Markdown>
            </article>
          )}
        </main>
      </div>
    </>
  );
}

function TB({ title, onClick, children }: { title: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" title={title} onClick={onClick}
      className="flex h-7 min-w-7 items-center justify-center rounded px-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100">
      {children}
    </button>
  );
}
