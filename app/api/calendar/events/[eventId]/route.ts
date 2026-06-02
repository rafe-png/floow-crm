/**
 * PATCH /api/calendar/events/[eventId]
 * DELETE /api/calendar/events/[eventId]
 */

import { NextResponse, type NextRequest } from "next/server";
import { getServerSupabase } from "@/lib/supabase/server";
import { deleteEvent, updateEvent } from "@/lib/google/calendar";

type Patch = {
  summary?: string;
  description?: string;
  startIso?: string;
  endIso?: string;
};

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ eventId: string }> },
) {
  const supabase = await getServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const { eventId } = await params;

  let body: Patch;
  try {
    body = (await req.json()) as Patch;
  } catch {
    return NextResponse.json({ error: "Body inválido" }, { status: 400 });
  }

  const result = await updateEvent(eventId, body);
  if (!result) {
    return NextResponse.json({ error: "Falha ao atualizar evento" }, { status: 502 });
  }
  return NextResponse.json(result);
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ eventId: string }> },
) {
  const supabase = await getServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const { eventId } = await params;
  const ok = await deleteEvent(eventId);
  return NextResponse.json({ ok });
}
