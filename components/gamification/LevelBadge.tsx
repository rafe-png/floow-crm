"use client";

import type { Level } from "@/lib/gamification";

export function LevelBadge({ level, points }: { level: Level; points: number }) {
  const pct = level.next
    ? Math.min(100, ((points - level.threshold) / (level.next - level.threshold)) * 100)
    : 100;
  const toNext = level.next ? level.next - points : 0;

  return (
    <div className="rounded-xl border border-zinc-900 bg-zinc-950/60 p-3 sm:p-4">
      <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
        Nível
      </div>
      <div className="flex items-baseline gap-2">
        <span className="text-2xl leading-none">{level.emoji}</span>
        <span className="text-xl font-bold" style={{ color: level.color }}>
          {level.name}
        </span>
      </div>
      <div className="mt-1 text-xs text-zinc-300">
        <span className="font-medium">{points.toLocaleString("pt-BR")}</span>
        <span className="ml-1 text-zinc-500">pts totais</span>
      </div>
      {level.next && (
        <div className="mt-2">
          <div className="h-1 w-full overflow-hidden rounded-full bg-zinc-900">
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${pct}%`, background: level.color }}
            />
          </div>
          <div className="mt-1 text-[10px] text-zinc-500">
            faltam {toNext.toLocaleString("pt-BR")} pts pro próximo nível
          </div>
        </div>
      )}
    </div>
  );
}
