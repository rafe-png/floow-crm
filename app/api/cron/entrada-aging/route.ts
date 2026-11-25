import { NextResponse } from "next/server";
import { getAdminSupabase } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 120;

// Vercel Cron diária. Move leads da ENTRADA (status 'qualificado') parados há mais de
// 30 dias — contados pela DATA DE ENTRADA no CRM (created_at) — pra "Reaquecimento"
// (sem_resposta). A pedido do Rafe (2026-11-12): a Entrada é organizada em faixas de
// temperatura por data de entrada e os +30d (frio) saem da Entrada pro Reaquecimento.
// Diferente da antiga stale-leads (7d sem Instagram, desligada): aqui é 30d, QUALQUER
// lead da Entrada. Só mexe em 'qualificado' — nunca em etapas do Closer/ganho/etc.
//
// Segurança: Bearer $CRON_SECRET (como a Vercel Cron envia) ou ?token=.
function authorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const auth = request.headers.get("authorization");
  if (auth === `Bearer ${secret}`) return true;
  return new URL(request.url).searchParams.get("token") === secret;
}

// DESLIGADO (2026-11-25): a cadência nova é de 20 dias com 3 toques/dia e, ao bater
// os 20 dias, o lead NÃO vai mais pro Reaquecimento — ele FICA na Entrada e a gente
// troca o SDR (via aviso no Dashboard). Esse auto-move pro "sem_resposta" deixou de
// existir. Mantido como no-op pra não quebrar o Vercel Cron já agendado; a lógica de
// 20 dias + troca de SDR vem na Fase 2 (relógio de ciclo + painel do Dashboard).
const DISABLED: boolean = true;

export async function GET(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  if (DISABLED) {
    return NextResponse.json({ ok: true, disabled: true, moved: 0 });
  }

  const days = parseInt(process.env.ENTRADA_FRIO_DAYS || "30", 10);
  const cutoff = new Date(Date.now() - days * 86_400_000).toISOString();
  const admin = getAdminSupabase();

  // Candidatos: Entrada (qualificado) com created_at mais velho que o corte. Pagina
  // (o PostgREST corta em 1000 por request).
  const ids: string[] = [];
  for (let from = 0; from < 200_000; from += 1000) {
    const { data, error } = await admin
      .from("leads").select("id")
      .eq("status", "qualificado").lt("created_at", cutoff)
      .order("created_at", { ascending: true }).range(from, from + 999);
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    if (!data || data.length === 0) break;
    ids.push(...(data.map((r) => r.id as string)));
    if (data.length < 1000) break;
  }

  // Move em lotes (o trigger do Postgres carimba timestamp + grava no histórico).
  let moved = 0;
  for (let i = 0; i < ids.length; i += 400) {
    const chunk = ids.slice(i, i + 400);
    const { data, error } = await admin.from("leads").update({ status: "sem_resposta" }).in("id", chunk).select("id");
    if (error) return NextResponse.json({ ok: false, error: error.message, moved }, { status: 500 });
    moved += data?.length ?? 0;
  }

  return NextResponse.json({ ok: true, moved, days });
}
