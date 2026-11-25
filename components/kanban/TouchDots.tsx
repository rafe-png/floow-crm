"use client";

import { DAILY_TOUCH_GOAL } from "@/lib/types";

type Props = {
  /** Ligações feitas HOJE pra esse lead (vem do useCallCount — reseta à meia-noite). */
  done: number;
  /** Meta de toques do dia (default 3). */
  goal?: number;
  /** true = lead na zona de cadência (Entrada → Qualificado) → cobra toque faltante. */
  active?: boolean;
  /** Tamanho da bolinha em px (default 10). */
  size?: number;
};

// As 3 BOLINHAS = os toques (ligações) do DIA. Cada ligação pinta uma bolinha de
// amarelo. Zeram todos os dias (o contador de origem usa a meia-noite local). Na
// zona de cadência, bolinha vazia fica em DESTAQUE (âmbar, pulsando) pra cobrar o
// toque que falta naquele lead naquele dia. Fora da cadência, só mostra o que já
// foi ligado hoje (bolinha vazia neutra, sem cobrança).
export function TouchDots({ done, goal = DAILY_TOUCH_GOAL, active = false, size = 10 }: Props) {
  const filled = Math.min(Math.max(done, 0), goal);
  const complete = filled >= goal;
  const missing = active && !complete;
  const dim = `${size}px`;

  return (
    <span
      className="inline-flex shrink-0 items-center gap-0.5"
      title={
        active
          ? complete
            ? `Toques de hoje: ${done}/${goal} · completo ✅`
            : `Toques de hoje: ${filled}/${goal} · falta ligar`
          : `Ligações de hoje: ${done}`
      }
      aria-label={`${filled} de ${goal} toques hoje`}
    >
      {Array.from({ length: goal }).map((_, i) => {
        const on = i < filled;
        return (
          <span
            key={i}
            style={{ height: dim, width: dim }}
            className={`rounded-full border transition-colors ${
              on
                ? "border-[#f5c518] bg-[#f5c518]"
                : missing
                  ? "animate-pulse border-amber-400/80 bg-amber-400/15"
                  : "border-zinc-600 bg-transparent"
            }`}
          />
        );
      })}
    </span>
  );
}
