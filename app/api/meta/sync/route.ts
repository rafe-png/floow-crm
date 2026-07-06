import { NextResponse } from "next/server";
import { format } from "date-fns";
import { fetchDailyInsights } from "@/lib/meta/insights";
import { getAdminSupabase, getServerSupabase } from "@/lib/supabase/server";
import { isAdminEmail } from "@/lib/types";

export const runtime = "nodejs";
// Puxar da Meta pode passar de alguns segundos em janelas grandes.
export const maxDuration = 60;

// Sincroniza o gasto diário de anúncios da Meta pro banco (tabela
// meta_ad_spend_daily). Faz UPSERT por dia — rodar de novo é seguro.
//
// Chamado de dois jeitos:
//  - Vercel Cron 1x/dia: "Authorization: Bearer $CRON_SECRET" (ou ?token=).
//  - Botão "Sincronizar" no Financeiro: sessão de admin logado.
//
// ?days=N controla a janela (default 90). Ex.: /api/meta/sync?days=365 no primeiro
// carregamento pra trazer o histórico.
async function authorized(request: Request): Promise<boolean> {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = request.headers.get("authorization");
    if (auth === `Bearer ${secret}`) return true;
    if (new URL(request.url).searchParams.get("token") === secret) return true;
  }
  // Sessão de admin logado (botão no app).
  try {
    const supabase = await getServerSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    if (user && isAdminEmail(user.email)) return true;
  } catch {
    /* sem sessão */
  }
  return false;
}

export async function GET(request: Request) {
  if (!(await authorized(request))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const daysParam = parseInt(new URL(request.url).searchParams.get("days") || "90", 10);
  const days = Number.isFinite(daysParam) ? Math.min(Math.max(daysParam, 1), 730) : 90;

  const until = new Date();
  const since = new Date(until.getTime() - (days - 1) * 86_400_000);

  try {
    const rows = await fetchDailyInsights(format(since, "yyyy-MM-dd"), format(until, "yyyy-MM-dd"));

    const admin = getAdminSupabase();
    const nowIso = new Date().toISOString();
    const payload = rows.map((r) => ({
      day: r.day,
      spend: r.spend,
      leads: r.leads,
      impressions: r.impressions,
      clicks: r.clicks,
      updated_at: nowIso,
    }));

    if (payload.length > 0) {
      const { error } = await admin.from("meta_ad_spend_daily").upsert(payload, { onConflict: "day" });
      if (error) {
        console.error("[meta sync] erro ao gravar:", error.message);
        return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
      }
    }

    const totalSpend = rows.reduce((s, r) => s + r.spend, 0);
    return NextResponse.json({ ok: true, days, synced: payload.length, totalSpend });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro ao sincronizar com a Meta.";
    console.error("[meta sync] erro:", message);
    return NextResponse.json({ ok: false, error: message }, { status: 502 });
  }
}
