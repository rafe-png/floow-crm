"use client";

import { useEffect, useMemo } from "react";

export type CelebrationKind = "meeting" | "win";

// Pseudo-aleatório determinístico (Math.sin é puro) — devolve 0..1.
function frac(n: number): number {
  const x = Math.sin(n) * 10000;
  return x - Math.floor(x);
}

const CONFIG: Record<
  CelebrationKind,
  { emojis: string[]; count: number; center: string; centerRing: boolean; label: string; labelClass: string }
> = {
  meeting: {
    emojis: ["✨", "⭐", "🎉", "📅"],
    count: 18,
    center: "📅",
    centerRing: false,
    label: "Reunião agendada!",
    labelClass: "text-blue-300",
  },
  win: {
    emojis: ["💰", "💵", "🤑", "⭐", "🔔", "🎉"],
    count: 36,
    center: "🔔",
    centerRing: true,
    label: "Negócio ganho! 💰",
    labelClass: "text-emerald-300",
  },
};

type Props = {
  kind: CelebrationKind;
  onDone: () => void;
};

export function Celebration({ kind, onDone }: Props) {
  const cfg = CONFIG[kind];

  const particles = useMemo(
    () =>
      Array.from({ length: cfg.count }, (_, i) => ({
        id: i,
        emoji: cfg.emojis[i % cfg.emojis.length],
        // Espalhamento pseudo-aleatório porém puro (sem Math.random durante render).
        left: frac(i * 12.9898) * 100,
        delay: frac(i * 78.233) * 0.5,
        duration: 1.1 + frac(i * 37.719) * 0.9,
        size: 18 + frac(i * 93.21) * 22,
      })),
    [cfg],
  );

  useEffect(() => {
    const t = setTimeout(onDone, 1800);
    return () => clearTimeout(t);
  }, [onDone]);

  return (
    <div className="floow-overlay pointer-events-none fixed inset-0 z-[100] overflow-hidden">
      {/* Partículas caindo */}
      {particles.map((p) => (
        <span
          key={p.id}
          className="floow-particle absolute top-0"
          style={{
            left: `${p.left}%`,
            fontSize: `${p.size}px`,
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.duration}s`,
          }}
        >
          {p.emoji}
        </span>
      ))}

      {/* Centro */}
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
        <div className="floow-pop flex flex-col items-center gap-2">
          <span className={cfg.centerRing ? "floow-ring text-7xl" : "text-7xl"}>{cfg.center}</span>
          <span
            className={`rounded-full border border-zinc-800 bg-zinc-950/80 px-4 py-1.5 text-base font-bold backdrop-blur ${cfg.labelClass}`}
          >
            {cfg.label}
          </span>
        </div>
      </div>
    </div>
  );
}
