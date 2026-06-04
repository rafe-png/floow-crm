"use client";

export type PillOption<T> = { value: T; label: string; color?: "sky" | "fuchsia" };

export function Pills<T extends string>({
  value, options, onChange,
}: { value: T | null; options: PillOption<T>[]; onChange: (v: T) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((opt) => {
        const selected = opt.value === value;
        const colorClass = selected
          ? opt.color === "sky"
            ? "border-sky-500/50 bg-sky-500/15 text-sky-200"
            : opt.color === "fuchsia"
            ? "border-fuchsia-500/50 bg-fuchsia-500/15 text-fuchsia-200"
            : "border-[#f5c518]/50 bg-[#f5c518]/15 text-[#f5c518]"
          : "border-zinc-800 bg-zinc-900 text-zinc-400 hover:border-zinc-700";
        return (
          <button
            key={String(opt.value)}
            type="button"
            onClick={() => onChange(opt.value)}
            className={`rounded-md border px-3 py-1.5 text-xs font-medium transition-colors ${colorClass}`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

export function PillRow<T extends string>({
  label, value, options, onChange,
}: { label: string; value: T | null; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div>
      <div className="mb-1 text-[11px] font-medium text-zinc-400">{label}</div>
      <Pills value={value} options={options} onChange={onChange} />
    </div>
  );
}
