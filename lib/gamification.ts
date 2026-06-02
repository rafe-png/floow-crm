import type { Lead, LeadEvent, Owner, UserGoals } from "@/lib/types";

// ============================================================
// Pontos
// ============================================================
//
// Regras (ajustáveis):
//  - Agendamento criado (lead novo em "reuniao_agendada")  → +10 pts SDR
//  - Reunião realizada (saiu de "reuniao_agendada" pra qualquer
//    coisa exceto no_show)                                  → +20 pts Closer
//  - Negócio ganho                                          → +100 pts Closer (+ 1% do valor)
//  - No show                                                → -5 pts SDR

export const POINTS = {
  agendamento_criado: 10,
  reuniao_realizada: 20,
  negocio_ganho: 100,
  no_show: -5,
};

type LeadById = Map<string, Lead>;

function indexLeads(leads: Lead[]): LeadById {
  const m = new Map<string, Lead>();
  for (const l of leads) m.set(l.id, l);
  return m;
}

export function computePoints(
  leads: Lead[],
  events: LeadEvent[],
  owner: Owner,
): number {
  const byId = indexLeads(leads);
  let total = 0;

  for (const ev of events) {
    const lead = byId.get(ev.lead_id);
    if (!lead) continue;
    if (lead.dono !== owner) continue;

    if (ev.tipo === "created" && ev.to_status === "reuniao_agendada") {
      if (owner === "SDR") total += POINTS.agendamento_criado;
    }

    if (ev.tipo === "status_change") {
      if (
        owner === "Closer" &&
        ev.from_status === "reuniao_agendada" &&
        ev.to_status &&
        !["reuniao_agendada", "no_show"].includes(ev.to_status)
      ) {
        total += POINTS.reuniao_realizada;
      }
      if (owner === "Closer" && ev.to_status === "negocio_ganho") {
        total += POINTS.negocio_ganho;
        if (lead.valor) total += Math.floor(Number(lead.valor) * 0.01);
      }
      if (owner === "SDR" && ev.to_status === "no_show") {
        total += POINTS.no_show;
      }
    }
  }

  return Math.max(0, total);
}

// ============================================================
// Streak (dias consecutivos batendo meta diária)
// ============================================================
function startOfDayLocal(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function dayKey(d: Date) {
  return startOfDayLocal(d).toISOString().slice(0, 10);
}

export function computeStreak(
  leads: Lead[],
  events: LeadEvent[],
  goal: UserGoals | undefined,
  owner: Owner,
): { current: number; best: number } {
  if (!goal || goal.daily_goal <= 0) return { current: 0, best: 0 };

  const byId = indexLeads(leads);

  // hits[day] = count of qualifying events on that day
  const hits: Record<string, number> = {};

  for (const ev of events) {
    const lead = byId.get(ev.lead_id);
    if (!lead || lead.dono !== owner) continue;

    const isHit =
      (owner === "SDR" && ev.tipo === "created" && ev.to_status === "reuniao_agendada") ||
      (owner === "Closer" && ev.tipo === "status_change" && ev.to_status === "negocio_ganho");

    if (!isHit) continue;
    const k = dayKey(new Date(ev.created_at));
    hits[k] = (hits[k] ?? 0) + 1;
  }

  // Current streak: walks back from today
  let current = 0;
  const cursor = startOfDayLocal(new Date());
  // se hoje ainda não bateu meta, NÃO quebra streak (ainda não acabou o dia).
  // Quebra só se ontem (dia anterior já fechado) não bateu.
  for (let i = 0; i < 366; i++) {
    const k = dayKey(cursor);
    const ok = (hits[k] ?? 0) >= goal.daily_goal;
    const isToday = i === 0;
    if (ok) {
      current++;
    } else if (!isToday) {
      break;
    }
    cursor.setDate(cursor.getDate() - 1);
  }

  // Best streak: scan all entries chronologically
  const allDays = Object.keys(hits).sort();
  let best = 0;
  let run = 0;
  let prev: Date | null = null;
  for (const day of allDays) {
    if ((hits[day] ?? 0) < goal.daily_goal) {
      run = 0;
      prev = null;
      continue;
    }
    const cur = new Date(day);
    if (prev) {
      const diff = (cur.getTime() - prev.getTime()) / 86400000;
      if (diff === 1) run++;
      else run = 1;
    } else {
      run = 1;
    }
    if (run > best) best = run;
    prev = cur;
  }

  if (current > best) best = current;
  return { current, best };
}

// ============================================================
// Nível
// ============================================================
export type Level = {
  name: "Bronze" | "Prata" | "Ouro" | "Diamante";
  emoji: string;
  current: number;
  threshold: number;
  next: number | null;
  color: string;
};

export function computeLevel(points: number): Level {
  const tiers: { name: Level["name"]; emoji: string; min: number; color: string }[] = [
    { name: "Bronze",   emoji: "🥉", min: 0,    color: "#cd7f32" },
    { name: "Prata",    emoji: "🥈", min: 501,  color: "#c0c0c0" },
    { name: "Ouro",     emoji: "🥇", min: 2001, color: "#f5c518" },
    { name: "Diamante", emoji: "💎", min: 5001, color: "#67e8f9" },
  ];

  let idx = 0;
  for (let i = 0; i < tiers.length; i++) {
    if (points >= tiers[i].min) idx = i;
  }
  const tier = tiers[idx];
  const next = tiers[idx + 1] ?? null;

  return {
    name: tier.name,
    emoji: tier.emoji,
    current: points,
    threshold: tier.min,
    next: next ? next.min : null,
    color: tier.color,
  };
}

// ============================================================
// Badges
// ============================================================
export type Badge = {
  id: string;
  emoji: string;
  label: string;
  description: string;
  earned: boolean;
};

export function computeBadges(
  leads: Lead[],
  events: LeadEvent[],
  owner: Owner,
  streak: { current: number; best: number },
): Badge[] {
  const byId = indexLeads(leads);
  const ownerLeads = leads.filter((l) => l.dono === owner);
  const wonLeads = ownerLeads.filter((l) => l.status === "negocio_ganho");
  const wonCount = wonLeads.length;
  const noShowCount = ownerLeads.filter((l) => l.status === "no_show").length;
  const meetingsHadAttempted = events.filter((ev) => {
    const lead = byId.get(ev.lead_id);
    return lead?.dono === owner && ev.tipo === "status_change" && ev.from_status === "reuniao_agendada";
  }).length;

  const noShowRate = meetingsHadAttempted > 0 ? noShowCount / meetingsHadAttempted : 0;
  const biggestDeal = wonLeads.reduce((max, l) => Math.max(max, Number(l.valor ?? 0)), 0);

  const badges: Badge[] = [];

  if (owner === "SDR") {
    badges.push({
      id: "primeiro_agendamento",
      emoji: "🎯",
      label: "Primeiro agendamento",
      description: "Marcou a primeira reunião do CRM.",
      earned: events.some((ev) => {
        const lead = byId.get(ev.lead_id);
        return lead?.dono === "SDR" && ev.tipo === "created" && ev.to_status === "reuniao_agendada";
      }),
    });
  } else {
    badges.push({
      id: "primeira_venda",
      emoji: "🏆",
      label: "Primeira venda",
      description: "Fechou o primeiro negócio.",
      earned: wonCount >= 1,
    });
  }

  badges.push({
    id: "streak_5",
    emoji: "🔥",
    label: "5 dias seguidos",
    description: "5 dias consecutivos batendo a meta diária.",
    earned: streak.best >= 5,
  });

  badges.push({
    id: "streak_15",
    emoji: "⚡",
    label: "15 dias na chama",
    description: "15 dias consecutivos batendo a meta.",
    earned: streak.best >= 15,
  });

  if (owner === "Closer") {
    badges.push({
      id: "big_deal",
      emoji: "💎",
      label: "Big deal",
      description: "Fechou um negócio acima de R$ 10.000.",
      earned: biggestDeal >= 10000,
    });
    badges.push({
      id: "ten_deals",
      emoji: "📈",
      label: "10 fechamentos",
      description: "Acumulou 10 negócios ganhos.",
      earned: wonCount >= 10,
    });
  }

  if (owner === "SDR" && meetingsHadAttempted >= 5) {
    badges.push({
      id: "low_no_show",
      emoji: "🎖️",
      label: "Qualifica bem",
      description: "Menos de 10% de no-show nas reuniões marcadas.",
      earned: noShowRate < 0.1,
    });
  }

  return badges;
}

// ============================================================
// Ranking (semana atual)
// ============================================================
function startOfIsoWeek(d: Date) {
  const x = new Date(d);
  const day = x.getDay();
  const diff = (day === 0 ? -6 : 1) - day;
  x.setDate(x.getDate() + diff);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function computeWeeklyPoints(
  leads: Lead[],
  events: LeadEvent[],
  owner: Owner,
): number {
  const weekStart = startOfIsoWeek(new Date());
  const inWeek = events.filter((ev) => new Date(ev.created_at) >= weekStart);
  return computePoints(leads, inWeek, owner);
}
