"use client";

import { Crown } from "lucide-react";

type Row = {
  owner: "SDR" | "Closer";
  weeklyPoints: number;
  totalPoints: number;
  streak: number;
};

export function RankingCard({ rows }: { rows: Row[] }) {
  const sorted = [...rows].sort((a, b) => b.weeklyPoints - a.weeklyPoints);
  const max = Math.max(1, ...sorted.map((r) => r.weeklyPoints));

  return (
    <div className="rounded-xl border border-zinc-900 bg-zinc-950/60 p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-zinc-200">Ranking da semana</h3>
        <span className="text-[10px] text-zinc-500">pontos desde segunda</span>
      </div>
      <ul className="space-y-3">
        {sorted.map((row, idx) => {
          const pct = (row.weeklyPoints / max) * 100;
          const isLeader = idx === 0 && row.weeklyPoints > 0;
          const dot = row.owner === "SDR" ? "bg-sky-400" : "bg-fuchsia-400";
          return (
            <li key={row.owner}>
              <div className="mb-1 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className={`h-2 w-2 rounded-full ${dot}`} />
                  <span className="text-sm font-medium text-zinc-200">{row.owner}</span>
                  {isLeader && <Crown size={12} className="text-[#f5c518]" />}
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-zinc-500">🔥 {row.streak}d</span>
                  <span className="font-semibold text-zinc-100">{row.weeklyPoints} pts</span>
                </div>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-900">
                <div
                  className={`h-full rounded-full transition-all ${
                    isLeader ? "bg-[#f5c518]" : "bg-zinc-700"
                  }`}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
