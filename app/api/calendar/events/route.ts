/**
 * POST /api/calendar/events
 * Cria um evento no Google Calendar com Meet link.
 */

import { NextResponse, type NextRequest } from "next/server";
import { getServerSupabase } from "@/lib/supabase/server";
import { createEvent } from "@/lib/google/calendar";

type Body = {
  summary: string;
  description?: string;
  startIso: string;
  endIso: string;
  attendees?: { email: string }[];
};

export async function POST(req: NextRequest) {
  const supabase = await getServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Body inválido" }, { status: 400 });
  }

  if (!body.summary || !body.startIso || !body.endIso) {
    return NextResponse.json({ error: "Campos obrigatórios faltando" }, { status: 400 });
  }

  const result = await createEvent(body);
  if (!result) {
    return NextResponse.json(
      { error: "Falha ao criar evento (verifique se a agenda está conectada)" },
      { status: 502 },
    );
  }

  return NextResponse.json(result);
}
