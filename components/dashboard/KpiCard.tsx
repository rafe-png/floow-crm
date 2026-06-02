"use client";

import { LucideIcon } from "lucide-react";

type Props = {
  icon: LucideIcon;
  label: string;
  value: string | number;
  sub?: string;
  accent?: "yellow" | "sky" | "fuchsia" | "emerald" | "neutral";
  progress?: { current: number; target: number };
};

const accents = {
  yellow:  { ring: "ring-[#f5c518]/20",  text: "text-[#f5c518]",  bg: "bg-[#f5c518]/10" },
  sky:     { ring: "ring-sky-500/20",    text: "text-sky-300",    bg: "bg-sky-500/10" },
  fuchsia: { ring: "ring-fuchsia-500/20",text: "text-fuchsia-300",bg: "bg-fuchsia-500/10" },
  emerald: { ring: "ring-emerald-500/20",text: "text-emerald-300",bg: "bg-emerald-500/10" },
  neutral: { ring: "ring-zinc-800",      text: "text-zinc-300",   bg: "bg-zinc-900" },
};

export function KpiCard({ icon: Icon, label, value, sub, accent = "neutral", progress }: Props) {
  const a = accents[accent];
  const pct = progress ? Math.min(100, (progress.current / Math.max(progress.target, 1)) * 100) : 0;
  const reached = progress && progress.current >= progress.target && progress.target > 0;

  return (
    <div className="rounded-xl border border-zinc-900 bg-zinc-950/60 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">{label}</div>
          <div className="text-2xl font-semibold text-zinc-100">{value}</div>
          {sub && <div className="text-xs text-zinc-500">{sub}</div>}
        </div>
        <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${a.bg}`}>
          <Icon size={18} className={a.text} />
        </div>
      </div>

      {progress && (
        <div className="mt-3">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-900">
            <div
              className={`h-full rounded-full transition-all ${reached ? "bg-[#f5c518]" : "bg-[#f5c518]/60"}`}
              style={{ width: `${pct}%` }}
            />
          </div>
          <div className="mt-1 text-[10px] text-zinc-500">
            {progress.current} de {progress.target}
            {reached && <span className="ml-1 font-semibold text-[#f5c518]">✓ meta batida</span>}
          </div>
        </div>
      )}
    </div>
  );
}
