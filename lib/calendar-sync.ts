/**
 * Helpers de sincronização com o Google Calendar.
 * Usados no client após salvar/editar/deletar lead.
 *
 * Comportamento: se a integração falhar (Google não conectado, API offline),
 * a operação no lead segue normalmente — só não cria o evento.
 */

import type { Lead } from "@/lib/types";

const DEFAULT_DURATION_MIN = 60;

function buildSummary(lead: Pick<Lead, "empresa" | "nome">) {
  const company = lead.empresa?.trim();
  const person = lead.nome?.trim();
  if (company && person) return `${company} · ${person}`;
  return company || person || "Reunião floow";
}

function buildDescription(lead: Lead): string {
  const parts: string[] = [];
  if (lead.empresa) parts.push(`Empresa: ${lead.empresa}`);
  if (lead.nome) parts.push(`Decisor: ${lead.nome}`);
  if (lead.telefone) parts.push(`WhatsApp: ${lead.telefone}`);
  if (lead.instagram) parts.push(`Instagram: @${lead.instagram}`);
  if (lead.sdr_responsavel) parts.push(`SDR: ${lead.sdr_responsavel}`);
  if (lead.closer_responsavel) parts.push(`Closer: ${lead.closer_responsavel}`);
  if (lead.observacoes) parts.push("", lead.observacoes);
  parts.push("", "— Criado automaticamente pelo floow CRM");
  return parts.join("\n");
}

function dateRange(iso: string): { startIso: string; endIso: string } {
  const start = new Date(iso);
  const end = new Date(start.getTime() + DEFAULT_DURATION_MIN * 60 * 1000);
  return { startIso: start.toISOString(), endIso: end.toISOString() };
}

export async function syncCreateEvent(lead: Lead): Promise<{
  eventId: string;
  meetLink: string | null;
} | null> {
  if (!lead.data_agendamento) return null;
  const { startIso, endIso } = dateRange(lead.data_agendamento);
  try {
    const res = await fetch("/api/calendar/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        summary: buildSummary(lead),
        description: buildDescription(lead),
        startIso,
        endIso,
      }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { eventId: string; meetLink: string | null };
    return data;
  } catch {
    return null;
  }
}

export async function syncUpdateEvent(eventId: string, lead: Lead): Promise<{
  meetLink: string | null;
} | null> {
  if (!lead.data_agendamento) return null;
  const { startIso, endIso } = dateRange(lead.data_agendamento);
  try {
    const res = await fetch(`/api/calendar/events/${encodeURIComponent(eventId)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        summary: buildSummary(lead),
        description: buildDescription(lead),
        startIso,
        endIso,
      }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { meetLink: string | null };
    return data;
  } catch {
    return null;
  }
}

export async function syncDeleteEvent(eventId: string): Promise<boolean> {
  try {
    const res = await fetch(`/api/calendar/events/${encodeURIComponent(eventId)}`, {
      method: "DELETE",
    });
    return res.ok;
  } catch {
    return false;
  }
}
