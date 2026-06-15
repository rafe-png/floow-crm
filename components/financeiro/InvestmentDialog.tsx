"use client";

import { useMemo, useState } from "react";
import {
  addDays,
  addMonths,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { dayKey } from "@/lib/finance";
import type { NewAdInvestmentInput } from "@/lib/types";

type Props = {
  open: boolean;
  covered: Set<string>; // dias "yyyy-MM-dd" já lançados (travados)
  onClose: () => void;
  onSubmit: (input: NewAdInvestmentInput) => Promise<void>;
};

const WEEKDAYS = ["D", "S", "T", "Q", "Q", "S", "S"];

export function InvestmentDialog({ open, covered, onClose, onSubmit }: Props) {
  const [cursor, setCursor] = useState(() => startOfMonth(new Date()));
  const [start, setStart] = useState<Date | null>(null);
  const [end, setEnd] = useState<Date | null>(null);
  const [valor, setValor] = useState("");
  const [leadsAds, setLeadsAds] = useState("");
  const [canal, setCanal] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const grid = useMemo(() => {
    const first = startOfWeek(startOfMonth(cursor), { weekStartsOn: 0 });
    const last = endOfWeek(endOfMonth(cursor), { weekStartsOn: 0 });
    const days: Date[] = [];
    let d = first;
    while (d.getTime() <= last.getTime()) {
      days.push(d);
      d = addDays(d, 1);
    }
    return days;
  }, [cursor]);

  if (!open) return null;

  function inRange(d: Date): boolean {
    if (!start) return false;
    const e = end ?? start;
    const lo = Math.min(start.getTime(), e.getTime());
    const hi = Math.max(start.getTime(), e.getTime());
    return d.getTime() >= lo && d.getTime() <= hi;
  }

  function pick(d: Date) {
    setError(null);
    if (covered.has(dayKey(d))) return; // dia travado
    // começa nova seleção
    if (!start || (start && end)) {
      setStart(d);
      setEnd(null);
      return;
    }
    // segunda ponta: define o fim (ordena) e valida que não cruza dia travado
    const lo = d.getTime() < start.getTime() ? d : start;
    const hi = d.getTime() < start.getTime() ? start : d;
    for (let x = lo; x.getTime() <= hi.getTime(); x = addDays(x, 1)) {
      if (covered.has(dayKey(x))) {
        setError("O período inclui dias já lançados. Escolha um intervalo livre.");
        setStart(d);
        setEnd(null);
        return;
      }
    }
    setStart(lo);
    setEnd(hi);
  }

  async function handleSave() {
    const v = parseFloat(valor.replace(/\./g, "").replace(",", "."));
    const leads = parseInt(leadsAds, 10);
    if (!start || !end) { setError("Selecione o período no calendário."); return; }
    if (Number.isNaN(v) || v <= 0) { setError("Informe o valor investido."); return; }
    if (Number.isNaN(leads) || leads < 0) { setError("Informe quantos leads os anúncios trouxeram."); return; }
    setSaving(true);
    setError(null);
    try {
      await onSubmit({
        periodo_inicio: dayKey(start),
        periodo_fim: dayKey(end),
        valor: v,
        leads_ads: leads,
        canal: canal.trim() || null,
      });
      onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro ao salvar.";
      setError(/overlap|exclus/i.test(msg) ? "Esse período se sobrepõe a um lançamento existente." : msg);
      setSaving(false);
    }
  }

  const rangeLabel =
    start && end
      ? `${format(start, "d MMM", { locale: ptBR })} – ${format(end, "d MMM", { locale: ptBR })}`
      : start
        ? `${format(start, "d MMM", { locale: ptBR })} – selecione o fim`
        : "Clique no início e no fim do período";

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-md rounded-xl border border-zinc-800 bg-zinc-950 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <header className="flex items-center justify-between border-b border-zinc-800 px-5 py-3">
          <h2 className="text-base font-semibold text-zinc-100">Lançar investimento</h2>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300" aria-label="Fechar">
            <X size={18} />
          </button>
        </header>

        <div className="px-5 py-4">
          {/* navegação do mês */}
          <div className="mb-2 flex items-center justify-between">
            <button onClick={() => setCursor(addMonths(cursor, -1))} className="rounded p-1 text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200">
              <ChevronLeft size={16} />
            </button>
            <span className="text-sm font-medium capitalize text-zinc-200">
              {format(cursor, "MMMM yyyy", { locale: ptBR })}
            </span>
            <button onClick={() => setCursor(addMonths(cursor, 1))} className="rounded p-1 text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200">
              <ChevronRight size={16} />
            </button>
          </div>

          <div className="mb-1 grid grid-cols-7 text-center text-[10px] font-medium uppercase text-zinc-600">
            {WEEKDAYS.map((w, i) => <span key={i}>{w}</span>)}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {grid.map((d) => {
              const out = !isSameMonth(d, cursor);
              const locked = covered.has(dayKey(d));
              const selected = inRange(d);
              return (
                <button
                  key={dayKey(d)}
                  type="button"
                  disabled={locked}
                  onClick={() => pick(d)}
                  className={`aspect-square rounded text-xs transition-colors ${
                    selected
                      ? "bg-[#f5c518] font-semibold text-zinc-950"
                      : locked
                        ? "cursor-not-allowed bg-zinc-900/60 text-zinc-700 line-through"
                        : out
                          ? "text-zinc-700 hover:bg-zinc-900"
                          : "text-zinc-300 hover:bg-zinc-800"
                  }`}
                  title={locked ? "Já lançado" : undefined}
                >
                  {format(d, "d")}
                </button>
              );
            })}
          </div>

          <p className="mt-2 text-center text-xs text-zinc-400">{rangeLabel}</p>

          <div className="mt-4 space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-sm text-zinc-500">R$</span>
              <input
                value={valor}
                onChange={(e) => setValor(e.target.value)}
                inputMode="decimal"
                placeholder="Valor investido"
                className="flex-1 rounded-md border border-zinc-800 bg-[#0f1218] px-3 py-2 text-sm text-zinc-100 outline-none focus:border-[#f5c518]"
              />
            </div>
            <div>
              <input
                value={leadsAds}
                onChange={(e) => setLeadsAds(e.target.value.replace(/\D/g, ""))}
                inputMode="numeric"
                placeholder="Leads que chegaram (mensagens dos anúncios)"
                className="w-full rounded-md border border-zinc-800 bg-[#0f1218] px-3 py-2 text-sm text-zinc-100 outline-none focus:border-[#f5c518]"
              />
              <p className="mt-1 text-[10px] text-zinc-600">Quantas mensagens/leads os anúncios trouxeram nesse período.</p>
            </div>
            <input
              value={canal}
              onChange={(e) => setCanal(e.target.value)}
              placeholder="Canal (opcional) — ex: Meta Ads"
              className="w-full rounded-md border border-zinc-800 bg-[#0f1218] px-3 py-2 text-sm text-zinc-100 outline-none focus:border-[#f5c518]"
            />
          </div>

          {error && (
            <div className="mt-3 rounded-md border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-300">
              {error}
            </div>
          )}
        </div>

        <footer className="flex justify-end gap-2 border-t border-zinc-800 px-5 py-3">
          <button onClick={onClose} type="button" className="rounded-md px-4 py-2 text-sm text-zinc-400 hover:text-zinc-200">
            Cancelar
          </button>
          <button
            onClick={handleSave}
            type="button"
            disabled={saving || !start || !end}
            className="rounded-md bg-[#f5c518] px-4 py-2 text-sm font-semibold text-zinc-950 hover:bg-[#ffd633] disabled:opacity-50"
          >
            {saving ? "Salvando…" : "Lançar"}
          </button>
        </footer>
      </div>
    </div>
  );
}
