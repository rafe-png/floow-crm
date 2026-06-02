"use client";

import { STATUS_COLORS, STATUS_LABELS, STATUS_ORDER, type Lead } from "@/lib/types";

type Props = { leads: Lead[] };

export function Funnel({ leads }: Props) {
  const counts: Record<string, number> = {};
  for (const s of STATUS_ORDER) counts[s] = 0;
  for (const l of leads) counts[l.status]++;

  const max = Math.max(1, ...Object.values(counts));

  return (
    <div className="rounded-xl border border-zinc-900 bg-zinc-950/60 p-4">
      <h3 className="mb-4 text-sm font-semibold text-zinc-200">Funil</h3>
      <div className="space-y-2">
        {STATUS_ORDER.map((s) => {
          const c = STATUS_COLORS[s];
          const n = counts[s];
          const pct = (n / max) * 100;
          return (
            <div key={s} className="flex items-center gap-3">
              <div className="flex w-32 shrink-0 items-center gap-1.5 text-xs">
                <span className={`h-1.5 w-1.5 rounded-full ${c.dot}`} />
                <span className={c.text}>{STATUS_LABELS[s]}</span>
              </div>
              <div className="flex-1">
                <div className="h-5 w-full overflow-hidden rounded bg-zinc-900">
                  <div
                    className={`h-full ${c.bg} ${c.text} flex items-center justify-end px-2 text-[10px] font-medium transition-all`}
                    style={{ width: `${Math.max(pct, n > 0 ? 8 : 0)}%` }}
                  >
                    {n > 0 && n}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
