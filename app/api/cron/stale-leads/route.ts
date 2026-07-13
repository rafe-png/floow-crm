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
  const preDays = parseInt(process.env.PRE_QUAL_STALE_DAYS || "30", 10);
  const cutoff = new Date(Date.now() - days * 86_400_000).toISOString();
  const preCutoff = new Date(Date.now() - preDays * 86_400_000).toISOString();

  const admin = getAdminSupabase();

  // 1) Entrada parada há > `days` dias (pela ENTRADA no CRM = created_at).
  const entrada = await admin
    .from("leads")
    .update({ status: "sem_resposta" })
    .eq("status", "qualificado")
    .lt("created_at", cutoff)
    .select("id");

  // 2) Pré qualificado parado há > `preDays` dias (pela última atividade = updated_at,
  //    já que o lead só chega aqui depois de a Entrada — created_at não serve).
  const preQual = await admin
    .from("leads")
    .update({ status: "sem_resposta" })
    .eq("status", "pre_qualificado")
    .lt("updated_at", preCutoff)
    .select("id");

  const error = entrada.error || preQual.error;
  if (error) {
    console.error("[cron stale-leads] erro:", error.message);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  const movedEntrada = entrada.data?.length ?? 0;
  const movedPreQual = preQual.data?.length ?? 0;
  return NextResponse.json({
    ok: true,
    moved: movedEntrada + movedPreQual,
    movedEntrada, movedPreQual, days, preDays,
  });
}
