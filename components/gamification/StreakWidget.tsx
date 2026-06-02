"use client";

import { Flame } from "lucide-react";

type Props = {
  current: number;
  best: number;
};

export function StreakWidget({ current, best }: Props) {
  const hot = current >= 3;
  return (
    <div className="rounded-xl border border-zinc-900 bg-zinc-950/60 p-3 sm:p-4">
      <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
        Streak
      </div>
      <div className="flex items-baseline gap-2">
        <Flame
          size={22}
          className={hot ? "text-orange-400" : "text-zinc-600"}
          fill={hot ? "currentColor" : "none"}
        />
        <span className={`text-2xl font-bold ${hot ? "text-orange-300" : "text-zinc-400"}`}>
          {current}
        </span>
        <span className="text-xs text-zinc-500">dia{current === 1 ? "" : "s"}</span>
      </div>
      <div className="mt-1 text-[10px] text-zinc-500">
        Recorde: {best} dia{best === 1 ? "" : "s"}
      </div>
    </div>
  );
}
