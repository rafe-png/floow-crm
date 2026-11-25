"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, Loader2, Scale, UserCog } from "lucide-react";
import { useLeadsContext } from "@/lib/contexts/LeadsContext";
import { useTeamContext } from "@/lib/contexts/TeamContext";
import { cadenceCycleDays, CADENCE_LIFETIME_DAYS, isCadenceExpired } from "@/lib/types";

type Assignment = { leadId: string; sdr: string };

// Aviso no topo do Dashboard: lista os leads que bateram os 20 dias da cadência.
// Admin escolhe o novo SDR — "um a um" (manual) ou "distribuir todos" (geral:
// rodízio entre os SDRs ou tudo pra um SDR). Trocar reinicia o relógio de 20 dias
// (a data de entrada original fica preservada). Só aparece pro admin e só quando
// há leads vencidos.
export function CadenceExpiryPanel() {
  const { leads } = useLeadsContext();
  const { isAdmin, members, currentMember } = useTeamContext();
  const [nowMs] = useState(() => Date.now());
  const [mode, setMode] = useState<"manual" | "geral">("geral");
  const [picks, setPicks] = useState<Record<string, string>>({});
  const [geralTarget, setGeralTarget] = useState("__rodizio__");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  // SDRs ativos (nomes únicos) — destinos possíveis da troca.
  const sdrNames = useMemo(() => {
    const set = new Set<string>();
    for (const m of members) if (m.role === "SDR" && m.active && m.name) set.add(m.name);
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [members]);

  // Leads vencidos (na cadência + 20d+), mais velhos primeiro.
  const expired = useMemo(
    () =>
      leads
        .filter((l) => isCadenceExpired(l, nowMs))
        .sort((a, b) => cadenceCycleDays(b, nowMs) - cadenceCycleDays(a, nowMs)),
    [leads, nowMs],
  );

  if (!isAdmin || expired.length === 0) return null;

  async function reassign(assignments: Assignment[]) {
    const clean = assignments.filter((a) => a.sdr && a.sdr.trim());
    if (clean.length === 0) {
      setMsg("Escolha o SDR pra pelo menos um lead.");
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/team/reassign-cadence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ assignments: clean, actor: currentMember?.name || "Admin" }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Falha ao trocar.");
      setPicks({});
      setMsg(`✅ ${j.updated} lead(s) trocado(s) — o relógio de 20 dias recomeçou.`);
    } catch (e) {
      setMsg(`❌ ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  }

  function applyManual() {
    const assignments = expired
      .map((l) => ({ leadId: l.id, sdr: picks[l.id] ?? "", cur: l.sdr_responsavel }))
      .filter((a) => a.sdr && a.sdr !== a.cur)
      .map(({ leadId, sdr }) => ({ leadId, sdr }));
    reassign(assignments);
  }

  function applyGeral() {
    if (sdrNames.length === 0) {
      setMsg("Nenhum SDR ativo pra distribuir.");
      return;
    }
    let assignments: Assignment[];
    if (geralTarget === "__rodizio__") {
      // Rodízio: distribui evitando devolver pro mesmo SDR quando dá.
      let rr = 0;
      assignments = expired.map((l) => {
        const pool = sdrNames.filter((n) => n !== l.sdr_responsavel);
        const list = pool.length ? pool : sdrNames;
        const sdr = list[rr % list.length];
        rr++;
        return { leadId: l.id, sdr };
      });
    } else {
      assignments = expired.map((l) => ({ leadId: l.id, sdr: geralTarget }));
    }
    reassign(assignments);
  }

  return (
    <section className="mb-6 rounded-2xl border border-amber-500/40 bg-amber-500/[0.06] p-4 sm:p-5">
      <div className="flex flex-wrap items-center gap-2">
        <AlertTriangle size={18} className="text-amber-400" />
        <h2 className="text-base font-bold text-amber-200">
          {expired.length} {expired.length === 1 ? "lead bateu" : "leads bateram"} os{" "}
          {CADENCE_LIFETIME_DAYS} dias de cadência
        </h2>
        <span className="text-xs text-amber-300/70">
          Escolha o novo SDR — trocar reinicia o relógio (a entrada original fica no histórico).
        </span>
      </div>

      {/* Toggle de modo */}
      <div className="mt-3 flex rounded-lg border border-amber-500/30 bg-zinc-950/40 p-0.5 text-xs">
        {(["geral", "manual"] as const).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 font-medium transition-colors ${
              mode === m ? "bg-amber-400 text-zinc-950" : "text-amber-200/80 hover:text-amber-100"
            }`}
          >
            {m === "geral" ? <Scale size={13} /> : <UserCog size={13} />}
            {m === "geral" ? "Distribuir todos" : "Um a um"}
          </button>
        ))}
      </div>

      {/* GERAL */}
      {mode === "geral" && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="text-sm text-zinc-300">Distribuir os {expired.length}:</span>
          <select
            value={geralTarget}
            onChange={(e) => setGeralTarget(e.target.value)}
            className="rounded-md border border-zinc-700 bg-zinc-900 px-2.5 py-1.5 text-sm text-zinc-100 outline-none [color-scheme:dark] hover:border-zinc-600"
          >
            <option value="__rodizio__">⚖️ Rodízio entre os SDRs</option>
            {sdrNames.map((n) => (
              <option key={n} value={n}>
                Tudo para {n}
              </option>
            ))}
          </select>
          <button
            onClick={applyGeral}
            disabled={busy}
            className="flex items-center gap-1.5 rounded-md bg-[#f5c518] px-3.5 py-1.5 text-sm font-semibold text-zinc-950 hover:bg-[#ffd633] disabled:opacity-50"
          >
            {busy && <Loader2 size={14} className="animate-spin" />}
            Distribuir
          </button>
        </div>
      )}

      {/* MANUAL */}
      {mode === "manual" && (
        <div className="mt-3">
          <div className="max-h-72 space-y-1.5 overflow-y-auto pr-1">
            {expired.map((l) => {
              const dias = Math.floor(cadenceCycleDays(l, nowMs));
              return (
                <div
                  key={l.id}
                  className="flex flex-wrap items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-950/50 px-3 py-2"
                >
                  <span className="min-w-0 flex-1 truncate text-sm font-medium text-zinc-100">
                    {l.empresa || l.nome}
                  </span>
                  <span className="shrink-0 text-[11px] text-zinc-500">
                    SDR atual: <span className="text-sky-300">{l.sdr_responsavel || "—"}</span>
                  </span>
                  <span className="shrink-0 rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-amber-300">
                    {dias}d
                  </span>
                  <select
                    value={picks[l.id] ?? ""}
                    onChange={(e) => setPicks((p) => ({ ...p, [l.id]: e.target.value }))}
                    className="shrink-0 rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs text-zinc-100 outline-none [color-scheme:dark] hover:border-zinc-600"
                  >
                    <option value="">→ novo SDR…</option>
                    {sdrNames.map((n) => (
                      <option key={n} value={n} disabled={n === l.sdr_responsavel}>
                        {n}
                      </option>
                    ))}
                  </select>
                </div>
              );
            })}
          </div>
          <button
            onClick={applyManual}
            disabled={busy}
            className="mt-3 flex items-center gap-1.5 rounded-md bg-[#f5c518] px-3.5 py-1.5 text-sm font-semibold text-zinc-950 hover:bg-[#ffd633] disabled:opacity-50"
          >
            {busy && <Loader2 size={14} className="animate-spin" />}
            Aplicar trocas
          </button>
        </div>
      )}

      {msg && <p className="mt-3 text-xs text-zinc-300">{msg}</p>}
    </section>
  );
}
