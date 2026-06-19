/**
 * POST /api/ext/calendar-reconcile
 * Usada pela EXTENSÃO do WhatsApp (que não tem cookies/sessão server-side).
 * Autentica pelo access_token do Supabase no header Authorization: Bearer <token>
 * e reconcilia o evento do Google Calendar com o estado atual do lead:
 *   - reunião agendada + data  → cria/atualiza o evento (e salva google_event_id/meet_link)
 *   - sem reunião/sem data      → apaga o evento se existir
 * O Google usa o token global da agenda conectada (igual ao app).
 */
import { NextResponse, type NextRequest } from "next/server";
import { getAdminSupabase } from "@/lib/supabase/server";
import { createEvent, updateEvent, deleteEvent } from "@/lib/google/calendar";
import type { Lead } from "@/lib/types";

const DURATION_MIN = 60;

function buildSummary(lead: Pick<Lead, "empresa" | "nome">) {
  const company = lead.empresa?.trim();
  const person = lead.nome?.trim();
  if (company && person) return `${company} · ${person}`;
  return company || person || "Reunião floow";
}

function buildDescription(lead: Lead): string {
  const parts: string[] = [];
  if (lead.empresa) parts.push(`Empresa: ${lead.empresa}`);
  if (lead.nome) parts.push(`Decisor: ${lead.nome}${lead.cargo ? ` (${lead.cargo})` : ""}`);
  if (lead.telefone) parts.push(`WhatsApp: ${lead.telefone}`);
  if (lead.instagram) parts.push(`Instagram: @${lead.instagram}`);
  if (lead.sdr_responsavel) parts.push(`SDR: ${lead.sdr_responsavel}`);
  if (lead.closer_responsavel) parts.push(`Closer: ${lead.closer_responsavel}`);
  if (lead.observacoes) parts.push("", lead.observacoes);
  parts.push("", "— Agendado pela extensão do floow CRM");
  return parts.join("\n");
}

function dateRange(iso: string) {
  const start = new Date(iso);
  const end = new Date(start.getTime() + DURATION_MIN * 60 * 1000);
  return { startIso: start.toISOString(), endIso: end.toISOString() };
}

export async function POST(req: NextRequest) {
  const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();
  if (!token) return NextResponse.json({ ok: false, error: "sem token" }, { status: 401 });

  const admin = getAdminSupabase();
  const { data: { user }, error: authErr } = await admin.auth.getUser(token);
  if (authErr || !user) return NextResponse.json({ ok: false, error: "não autenticado" }, { status: 401 });

  let leadId: string | undefined;
  try {
    ({ leadId } = (await req.json()) as { leadId?: string });
  } catch {
    return NextResponse.json({ ok: false, error: "body inválido" }, { status: 400 });
  }
  if (!leadId) return NextResponse.json({ ok: false, error: "leadId faltando" }, { status: 400 });

  const { data: lead } = await admin.from("leads").select("*").eq("id", leadId).single();
  if (!lead) return NextResponse.json({ ok: false, error: "lead não encontrado" }, { status: 404 });

  const wantsEvent = !!lead.data_agendamento && lead.status === "reuniao_agendada";

  if (wantsEvent) {
    const { startIso, endIso } = dateRange(lead.data_agendamento as string);
    const payload = { summary: buildSummary(lead), description: buildDescription(lead), startIso, endIso };

    if (lead.google_event_id) {
      const r = await updateEvent(lead.google_event_id, payload);
      if (!r) return NextResponse.json({ ok: false, error: "agenda não conectada" }, { status: 502 });
      if (r.meetLink && r.meetLink !== lead.meet_link) {
        await admin.from("leads").update({ meet_link: r.meetLink }).eq("id", leadId);
      }
      return NextResponse.json({ ok: true, action: "updated", eventId: lead.google_event_id });
    }

    const r = await createEvent(payload);
    if (!r) return NextResponse.json({ ok: false, error: "agenda não conectada" }, { status: 502 });
    await admin.from("leads").update({ google_event_id: r.eventId, meet_link: r.meetLink }).eq("id", leadId);
    return NextResponse.json({ ok: true, action: "created", eventId: r.eventId, meetLink: r.meetLink });
  }

  // Sem reunião marcada: remove o evento se existir (lead voltou/no-show).
  if (lead.google_event_id) {
    await deleteEvent(lead.google_event_id);
    await admin.from("leads").update({ google_event_id: null, meet_link: null }).eq("id", leadId);
    return NextResponse.json({ ok: true, action: "deleted" });
  }
  return NextResponse.json({ ok: true, action: "noop" });
}
