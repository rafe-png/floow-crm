"use client";

type Props = {
  label: string;
  current: number;
  target: number;
  size?: number;
  strokeWidth?: number;
  accent?: string;
};

export function MetaRing({
  label,
  current,
  target,
  size = 140,
  strokeWidth = 12,
  accent = "#f5c518",
}: Props) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const safeTarget = Math.max(target, 1);
  const pct = Math.min(1, current / safeTarget);
  const dashOffset = circumference * (1 - pct);
  const reached = current >= target && target > 0;

  return (
    <div className="flex flex-col items-center">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90 transform">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke="#1c1c1c"
            strokeWidth={strokeWidth}
            fill="none"
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={accent}
            strokeWidth={strokeWidth}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
            className="transition-all duration-700"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-3xl font-bold leading-none text-zinc-100 sm:text-4xl">
            {current}
          </span>
          <span className="mt-1 text-xs text-zinc-500">de {target}</span>
        </div>
      </div>
      <div className="mt-3 flex items-center gap-1.5">
        <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
          {label}
        </span>
        {reached && <span className="text-sm">🎯</span>}
      </div>
    </div>
  );
}
