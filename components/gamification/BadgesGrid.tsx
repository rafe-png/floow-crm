"use client";

import type { Badge } from "@/lib/gamification";

type Props = {
  badges: Badge[];
};

export function BadgesGrid({ badges }: Props) {
  const earnedCount = badges.filter((b) => b.earned).length;
  return (
    <div className="rounded-xl border border-zinc-900 bg-zinc-950/60 p-3 sm:p-4">
      <div className="mb-2 flex items-center justify-between">
        <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
          Conquistas
        </div>
        <div className="text-[10px] text-zinc-500">
          {earnedCount}/{badges.length}
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        {badges.map((b) => (
          <div
            key={b.id}
            title={`${b.label}\n${b.description}`}
            className={`flex flex-col items-center justify-center gap-1 rounded-lg border p-2 transition-colors ${
              b.earned
                ? "border-[#f5c518]/30 bg-[#f5c518]/5"
                : "border-zinc-900 bg-zinc-900/30 opacity-50 grayscale"
            }`}
          >
            <span className="text-xl leading-none">{b.emoji}</span>
            <span className="text-center text-[9px] font-medium text-zinc-300 leading-tight">
              {b.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
