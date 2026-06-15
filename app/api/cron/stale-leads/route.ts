import { NextResponse } from "next/server";
import { getAdminSupabase } from "@/lib/supabase/server";

export const runtime = "nodejs";

// Chamado pela Vercel Cron 1x/dia. Move leads que entraram há X dias e ainda
// estão na "Entrada" (status 'qualificado') pra "Sem resposta" — se ninguém
// os tirou da Entrada nesse tempo, é porque não engajaram.
//
// Segurança: a Vercel Cron envia "Authorization: Bearer $CRON_SECRET".
// Também aceita ?token= pra você poder rodar na mão se quiser.
function authorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const auth = request.headers.get("authorization");
  if (auth === `Bearer ${secret}`) return true;
  return new URL(request.url).searchParams.get("token") === secret;
}

export async function GET(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const days = parseInt(process.env.STALE_LEAD_DAYS || "7", 10);
  const cutoff = new Date(Date.now() - days * 86_400_000).toISOString();

  const admin = getAdminSupabase();
  const { data, error } = await admin
    .from("leads")
    .update({ status: "sem_resposta" })
    .eq("status", "qualificado") // ainda na Entrada
    .lt("created_at", cutoff) // entrou há mais de X dias
    .select("id");

  if (error) {
    console.error("[cron stale-leads] erro:", error.message);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  const moved = data?.length ?? 0;
  return NextResponse.json({ ok: true, moved, days });
}
