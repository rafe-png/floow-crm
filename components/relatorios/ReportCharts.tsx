"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { CreativeStat, MonthStat, WeekdayStat } from "@/lib/reports";

const axis = { fontSize: 11, fill: "#71717a" };
const tooltipStyle = {
  background: "#0f1218",
  border: "1px solid #27272a",
  borderRadius: 8,
  fontSize: 12,
  color: "#e7e9ee",
};

function ChartCard({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-zinc-900 bg-zinc-950/60 p-4">
      <h3 className="text-sm font-semibold text-zinc-200">{title}</h3>
      {hint && <p className="mb-2 text-[11px] text-zinc-500">{hint}</p>}
      <div className="mt-2 h-56 w-full">{children}</div>
    </div>
  );
}

/** Leads por mês de entrada: chegaram → qualificaram → ganharam. */
export function MonthlyBars({ data }: { data: MonthStat[] }) {
  return (
    <ChartCard title="Evolução mensal" hint="Por mês de entrada do lead: quantos chegaram, qualificaram e ganharam">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} barGap={2}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1f1f23" vertical={false} />
          <XAxis dataKey="label" tick={axis} axisLine={false} tickLine={false} />
          <YAxis tick={axis} axisLine={false} tickLine={false} allowDecimals={false} width={28} />
          <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "#ffffff08" }} />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          <Bar dataKey="chegaram" name="Chegaram" fill="#38bdf8" radius={[3, 3, 0, 0]} />
          <Bar dataKey="qualificados" name="Qualificados" fill="#f5c518" radius={[3, 3, 0, 0]} />
          <Bar dataKey="ganhos" name="Ganhos" fill="#34d399" radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

/** Desempenho por dia da semana. */
export function WeekdayBars({ data }: { data: WeekdayStat[] }) {
  return (
    <ChartCard title="Por dia da semana" hint="Dia que mais sai venda (ganho) e dia que chegam os leads que convertem">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} barGap={2}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1f1f23" vertical={false} />
          <XAxis dataKey="label" tick={axis} axisLine={false} tickLine={false} />
          <YAxis tick={axis} axisLine={false} tickLine={false} allowDecimals={false} width={28} />
          <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "#ffffff08" }} />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          <Bar dataKey="ganhos" name="Vendas (ganho)" fill="#34d399" radius={[3, 3, 0, 0]} />
          <Bar dataKey="leadsGanhos" name="Entrada dos ganhos" fill="#38bdf8" radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

/** Quais criativos mais vendem. */
export function CreativeBars({ data }: { data: CreativeStat[] }) {
  const top = data.slice(0, 12);
  return (
    <ChartCard title="Criativos que mais vendem" hint="Negócios ganhos por código de criativo">
      {top.length === 0 ? (
        <div className="flex h-full items-center justify-center text-xs text-zinc-600">
          Sem criativos registrados ainda. Os códigos aparecem ao ganhar negócios.
        </div>
      ) : (
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={top} layout="vertical" margin={{ left: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1f1f23" horizontal={false} />
            <XAxis type="number" tick={axis} axisLine={false} tickLine={false} allowDecimals={false} />
            <YAxis type="category" dataKey="label" tick={axis} axisLine={false} tickLine={false} width={44} />
            <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "#ffffff08" }} />
            <Bar dataKey="ganhos" name="Ganhos" radius={[0, 3, 3, 0]}>
              {top.map((_, i) => (
                <Cell key={i} fill={i === 0 ? "#f5c518" : "#34d399"} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </ChartCard>
  );
}
