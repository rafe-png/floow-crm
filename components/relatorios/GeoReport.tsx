"use client";

import { useMemo, useState } from "react";
import { MapPin } from "lucide-react";
import {
  buildGeoStats,
  GEO_OUTCOME_LABELS,
  type GeoOutcome,
} from "@/lib/reports";
import type { Lead } from "@/lib/types";

// Grade de estados do Brasil (mapa em "tiles" — legível e sem depender de internet).
// [linha, coluna] aproximando a geografia: Norte em cima, Sul embaixo,
// Nordeste no canto superior direito.
const TILE_POS: Record<string, [number, number]> = {
  RR: [0, 2], AP: [0, 4],
  AM: [1, 1], PA: [1, 3], MA: [1, 4], CE: [1, 5], RN: [1, 6],
  AC: [2, 0], RO: [2, 1], TO: [2, 3], PI: [2, 4], PE: [2, 5], PB: [2, 6],
  MT: [3, 2], BA: [3, 4], SE: [3, 5], AL: [3, 6],
  MS: [4, 2], GO: [4, 3], DF: [4, 4], MG: [4, 5], ES: [4, 6],
  SP: [5, 4], RJ: [5, 5],
  PR: [6, 3], SC: [6, 4],
  RS: [7, 3],
};
const GRID_COLS = 7;
const GRID_ROWS = 8;

// Cor por recorte (hue) — a intensidade varia pela contagem.
const OUTCOME_RGB: Record<GeoOutcome, [number, number, number]> = {
  todos: [245, 197, 24],    // amarelo (marca)
  ganhos: [16, 185, 129],   // verde
  perdidos: [244, 63, 94],  // vermelho
  agendados: [56, 189, 248],// azul
};

const OUTCOMES: GeoOutcome[] = ["todos", "ganhos", "perdidos", "agendados"];

// Paleta pra pizza (por estado).
const PIE_COLORS = ["#f5c518", "#38bdf8", "#a78bfa", "#34d399", "#fb7185", "#fbbf24", "#60a5fa", "#f472b6"];

export function GeoReport({ leads }: { leads: Lead[] }) {
  const [outcome, setOutcome] = useState<GeoOutcome>("todos");
  const geo = useMemo(() => buildGeoStats(leads, outcome), [leads, outcome]);
  const [r, g, b] = OUTCOME_RGB[outcome];

  const countByUf = useMemo(() => {
    const m: Record<string, { count: number; nome: string }> = {};
    for (const e of geo.byEstado) m[e.uf] = { count: e.count, nome: e.nome };
    return m;
  }, [geo]);

  // Top estados pra pizza (6 + "Outros").
  const pieData = useMemo(() => {
    const top = geo.byEstado.slice(0, 6);
    const rest = geo.byEstado.slice(6).reduce((s, e) => s + e.count, 0);
    const arr = top.map((e, i) => ({ label: e.uf, value: e.count, color: PIE_COLORS[i % PIE_COLORS.length] }));
    if (rest > 0) arr.push({ label: "Outros", value: rest, color: "#52525b" });
    return arr;
  }, [geo]);

  return (
    <section className="rounded-xl border border-zinc-800 bg-zinc-950/40 p-4 sm:p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <MapPin className="h-5 w-5 text-[#f5c518]" />
          <h2 className="text-base font-semibold text-zinc-100">Localização dos leads</h2>
        </div>
        {/* Filtro por resultado */}
        <div className="flex flex-wrap gap-1">
          {OUTCOMES.map((o) => (
            <button
              key={o}
              onClick={() => setOutcome(o)}
              className={`rounded-md border px-2.5 py-1 text-xs font-medium transition-colors ${
                outcome === o
                  ? "border-[#f5c518]/50 bg-[#f5c518]/15 text-[#f5c518]"
                  : "border-zinc-800 bg-zinc-900 text-zinc-400 hover:border-zinc-700"
              }`}
            >
              {GEO_OUTCOME_LABELS[o]}
            </button>
          ))}
        </div>
      </div>

      {geo.total === 0 ? (
        <p className="py-8 text-center text-sm text-zinc-500">
          Nenhum lead com localização nesse recorte ainda.
          {geo.semLocal > 0 && ` (${geo.semLocal} sem cidade/estado preenchido)`}
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* ----- Mapa de calor (tiles) ----- */}
          <div>
            <div
              className="mx-auto grid gap-1"
              style={{
                gridTemplateColumns: `repeat(${GRID_COLS}, minmax(0, 1fr))`,
                gridTemplateRows: `repeat(${GRID_ROWS}, 1fr)`,
                maxWidth: 360,
                aspectRatio: `${GRID_COLS} / ${GRID_ROWS}`,
              }}
            >
              {Object.entries(TILE_POS).map(([uf, [row, col]]) => {
                const info = countByUf[uf];
                const count = info?.count ?? 0;
                const intensity = geo.maxCount > 0 ? count / geo.maxCount : 0;
                const alpha = count === 0 ? 0 : 0.18 + 0.82 * intensity;
                const bg = count === 0 ? "rgba(255,255,255,0.03)" : `rgba(${r},${g},${b},${alpha})`;
                const bright = intensity > 0.55;
                return (
                  <div
                    key={uf}
                    title={`${info?.nome ?? uf}: ${count} lead${count === 1 ? "" : "s"}`}
                    style={{ gridColumn: col + 1, gridRow: row + 1, background: bg }}
                    className={`flex flex-col items-center justify-center rounded-[5px] border text-center ${
                      count === 0 ? "border-zinc-800/60" : "border-transparent"
                    }`}
                  >
                    <span className={`text-[10px] font-bold leading-none ${bright ? "text-zinc-950" : "text-zinc-300"}`}>
                      {uf}
                    </span>
                    {count > 0 && (
                      <span className={`text-[9px] leading-tight ${bright ? "text-zinc-900" : "text-zinc-400"}`}>
                        {count}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
            {/* legenda */}
            <div className="mt-3 flex items-center justify-center gap-2 text-[10px] text-zinc-500">
              <span>menos</span>
              <div className="h-2 w-28 rounded-full" style={{ background: `linear-gradient(90deg, rgba(${r},${g},${b},0.18), rgba(${r},${g},${b},1))` }} />
              <span>mais</span>
            </div>
          </div>

          {/* ----- Pizza + ranking ----- */}
          <div className="space-y-5">
            <div className="flex items-center gap-4">
              <Pie data={pieData} />
              <ul className="flex-1 space-y-1">
                {pieData.map((d) => (
                  <li key={d.label} className="flex items-center gap-2 text-xs text-zinc-300">
                    <span className="h-2.5 w-2.5 rounded-sm" style={{ background: d.color }} />
                    <span className="font-medium">{d.label}</span>
                    <span className="ml-auto text-zinc-500">{d.value} · {Math.round((d.value / geo.total) * 100)}%</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Ranking por cidade */}
            <div>
              <div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-zinc-500">Top cidades</div>
              <ul className="space-y-1.5">
                {geo.byCidade.slice(0, 6).map((c) => {
                  const pct = geo.byCidade[0] ? (c.count / geo.byCidade[0].count) * 100 : 0;
                  return (
                    <li key={`${c.cidade}-${c.uf}`} className="flex items-center gap-2">
                      <span className="w-32 shrink-0 truncate text-xs text-zinc-300" title={`${c.cidade} — ${c.uf}`}>
                        {c.cidade} <span className="text-zinc-600">{c.uf}</span>
                      </span>
                      <div className="h-2 flex-1 overflow-hidden rounded-full bg-zinc-900">
                        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: `rgb(${r},${g},${b})` }} />
                      </div>
                      <span className="w-6 text-right text-xs text-zinc-400">{c.count}</span>
                    </li>
                  );
                })}
              </ul>
              {geo.semLocal > 0 && (
                <p className="mt-2 text-[11px] text-zinc-600">{geo.semLocal} lead(s) sem cidade/estado preenchido.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

// Pizza simples em SVG.
function Pie({ data }: { data: { label: string; value: number; color: string }[] }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  const cx = 60, cy = 60, R = 55;
  if (total === 0) return <div className="h-[120px] w-[120px]" />;

  // Caso especial: uma fatia só = círculo cheio (arco de 360° não desenha).
  if (data.length === 1) {
    return (
      <svg width={120} height={120} viewBox="0 0 120 120" className="shrink-0">
        <circle cx={cx} cy={cy} r={R} fill={data[0].color} />
      </svg>
    );
  }

  let angle = -90;
  const toXY = (deg: number) => [cx + R * Math.cos((deg * Math.PI) / 180), cy + R * Math.sin((deg * Math.PI) / 180)];

  return (
    <svg width={120} height={120} viewBox="0 0 120 120" className="shrink-0">
      {data.map((d) => {
        const frac = d.value / total;
        const start = angle;
        const end = angle + frac * 360;
        angle = end;
        const [x1, y1] = toXY(start);
        const [x2, y2] = toXY(end);
        const large = frac > 0.5 ? 1 : 0;
        const path = `M ${cx} ${cy} L ${x1.toFixed(2)} ${y1.toFixed(2)} A ${R} ${R} 0 ${large} 1 ${x2.toFixed(2)} ${y2.toFixed(2)} Z`;
        return <path key={d.label} d={path} fill={d.color} stroke="#0a0a0a" strokeWidth={1} />;
      })}
    </svg>
  );
}
