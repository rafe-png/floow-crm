"use client";

import { useMemo, useState } from "react";
import { Check, Pencil, Plus, X } from "lucide-react";
import { useGoalsContext } from "@/lib/contexts/GoalsContext";
import { useLeadsContext } from "@/lib/contexts/LeadsContext";
import type { Lead, Owner } from "@/lib/types";

type Props = {
  title: string;
  onNewLead?: () => void;
};

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function startOfIsoWeek(d: Date) {
  const x = new Date(d);
  const day = x.getDay();
  const diff = (day === 0 ? -6 : 1) - day;
  x.setDate(x.getDate() + diff);
  x.setHours(0, 0, 0, 0);
  return x;
}

// Contagem estável: usa timestamps fotográficos (agendado_em/ganho_em).
// Uma vez agendada, conta no dia do agendamento pra sempre — mesmo que
// o card depois saia da etapa.
function countForSdr(leads: Lead[]) {
  const today = startOfDay(new Date());
  const weekStart = startOfIsoWeek(new Date());
  let day = 0, week = 0;
  for (const l of leads) {
    if (l.dono !== "SDR") continue;
    if (!l.agendado_em) continue;
    const ts = new Date(l.agendado_em);
    if (ts >= today) day++;
    if (ts >= weekStart) week++;
  }
  return { day, week };
}

function countForCloser(leads: Lead[]) {
  const today = startOfDay(new Date());
  const weekStart = startOfIsoWeek(new Date());
  let day = 0, week = 0;
  for (const l of leads) {
    if (l.dono !== "Closer") continue;
    if (!l.ganho_em) continue;
    const ts = new Date(l.ganho_em);
    if (ts >= today) day++;
    if (ts >= weekStart) week++;
  }
  return { day, week };
}

export function TopBar({ title, onNewLead }: Props) {
  const { leads } = useLeadsContext();
  const { goals, updateGoals } = useGoalsContext();

  const [editing, setEditing] = useState<Owner | null>(null);
  const [draftDaily, setDraftDaily] = useState("");
  const [draftWeekly, setDraftWeekly] = useState("");

  const sdrCounts = useMemo(() => countForSdr(leads), [leads]);
  const closerCounts = useMemo(() => countForCloser(leads), [leads]);

  function startEdit(owner: Owner) {
    const g = goals[owner];
    if (!g) return;
    setDraftDaily(String(g.daily_goal));
    setDraftWeekly(String(g.weekly_goal));
    setEditing(owner);
  }

  async function saveEdit() {
    if (!editing) return;
    const d = parseInt(draftDaily, 10);
    const w = parseInt(draftWeekly, 10);
    if (Number.isNaN(d) || Number.isNaN(w) || d < 0 || w < 0) return;
    await updateGoals(editing, d, w);
    setEditing(null);
  }

  return (
    <header className="border-b border-zinc-900 bg-[#0a0a0a]">
      <div className="flex items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <h1 className="text-sm font-semibold text-zinc-200 sm:text-base">{title}</h1>

        <div className="flex items-center gap-2">
          {onNewLead && (
            <button
              onClick={onNewLead}
              className="flex items-center gap-1.5 rounded-md bg-[#f5c518] px-3 py-1.5 text-xs font-semibold text-zinc-950 hover:bg-[#ffd633]"
            >
              <Plus size={14} strokeWidth={2.5} />
              <span className="hidden sm:inline">Novo lead</span>
            </button>
          )}
        </div>
      </div>

      {/* Metas */}
      <div className="flex flex-wrap items-center gap-4 border-t border-zinc-900/60 px-4 py-2.5 sm:px-6">
        <MetaBlock
          owner="SDR"
          label="SDR · agendamentos"
          counts={sdrCounts}
          daily={goals.SDR?.daily_goal ?? 0}
          weekly={goals.SDR?.weekly_goal ?? 0}
          editing={editing === "SDR"}
          onEdit={() => startEdit("SDR")}
          onCancel={() => setEditing(null)}
          onSave={saveEdit}
          draftDaily={draftDaily}
          draftWeekly={draftWeekly}
          setDraftDaily={setDraftDaily}
          setDraftWeekly={setDraftWeekly}
          color="sky"
        />
        <MetaBlock
          owner="Closer"
          label="Closer · fechamentos"
          counts={closerCounts}
          daily={goals.Closer?.daily_goal ?? 0}
          weekly={goals.Closer?.weekly_goal ?? 0}
          editing={editing === "Closer"}
          onEdit={() => startEdit("Closer")}
          onCancel={() => setEditing(null)}
          onSave={saveEdit}
          draftDaily={draftDaily}
          draftWeekly={draftWeekly}
          setDraftDaily={setDraftDaily}
          setDraftWeekly={setDraftWeekly}
          color="fuchsia"
        />
      </div>
    </header>
  );
}

type BlockProps = {
  owner: Owner;
  label: string;
  counts: { day: number; week: number };
  daily: number;
  weekly: number;
  editing: boolean;
  onEdit: () => void;
  onCancel: () => void;
  onSave: () => void;
  draftDaily: string;
  draftWeekly: string;
  setDraftDaily: (v: string) => void;
  setDraftWeekly: (v: string) => void;
  color: "sky" | "fuchsia";
};

function MetaBlock({
  label, counts, daily, weekly, editing, onEdit, onCancel, onSave,
  draftDaily, draftWeekly, setDraftDaily, setDraftWeekly, color,
}: BlockProps) {
  const dot = color === "sky" ? "bg-sky-400" : "bg-fuchsia-400";

  return (
    <div className="flex min-w-[280px] flex-1 items-center gap-3">
      <span className={`h-2 w-2 shrink-0 rounded-full ${dot}`} />
      <div className="flex flex-1 flex-col">
        <div className="mb-1 flex items-center justify-between text-[10px] font-medium uppercase tracking-wide text-zinc-500">
          <span>{label}</span>
          {!editing ? (
            <button onClick={onEdit} className="text-zinc-500 hover:text-zinc-300">
              <Pencil size={10} />
            </button>
          ) : (
            <div className="flex items-center gap-1">
              <NumberInput value={draftDaily} onChange={setDraftDaily} placeholder="Dia" />
              <span className="text-zinc-600">/</span>
              <NumberInput value={draftWeekly} onChange={setDraftWeekly} placeholder="Sem" />
              <button onClick={onSave} className="text-emerald-400" aria-label="Salvar">
                <Check size={12} />
              </button>
              <button onClick={onCancel} className="text-zinc-500" aria-label="Cancelar">
                <X size={12} />
              </button>
            </div>
          )}
        </div>

        <div className="flex gap-3">
          <Gauge label="Hoje" current={counts.day} target={daily} />
          <Gauge label="Semana" current={counts.week} target={weekly} />
        </div>
      </div>
    </div>
  );
}

function Gauge({ label, current, target }: { label: string; current: number; target: number }) {
  const safe = Math.max(target, 1);
  const pct = Math.min(100, (current / safe) * 100);
  const reached = current >= target && target > 0;
  return (
    <div className="flex-1">
      <div className="mb-0.5 flex items-center justify-between text-[10px]">
        <span className="text-zinc-500">{label}</span>
        <span className={reached ? "font-semibold text-[#f5c518]" : "text-zinc-300"}>
          {current} / {target}
        </span>
      </div>
      <div className="h-1 w-full overflow-hidden rounded-full bg-zinc-900">
        <div
          className={`h-full rounded-full transition-all ${reached ? "bg-[#f5c518]" : "bg-[#f5c518]/60"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function NumberInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <input
      type="number"
      min={0}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-10 rounded border border-zinc-800 bg-zinc-900 px-1 py-0.5 text-center text-[10px] text-zinc-100 outline-none focus:border-[#f5c518]"
    />
  );
}
