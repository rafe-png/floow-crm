import { NextResponse } from "next/server";
import { getAdminSupabaseGuard } from "../guard";

export const runtime = "nodejs";

// Troca de SDR dos leads que bateram os 20 dias da cadência (aviso do Dashboard).
// Admin-only. Pra cada lead: troca sdr_responsavel E reinicia o relógio do ciclo
// (ciclo_entrada_em = agora) — a data de entrada original (created_at) NÃO muda.
// Grava um evento 'note' no histórico de cada lead. Service_role (ignora RLS).
type Assignment = { leadId: string; sdr: string };

export async function POST(request: Request) {
  const guard = await getAdminSupabaseGuard();
  if (!guard.ok) return guard.response;
  const admin = guard.admin;

  let body: { assignments?: Assignment[]; actor?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }

  const assignments = (body.assignments ?? []).filter(
    (a): a is Assignment =>
      !!a && typeof a.leadId === "string" && typeof a.sdr === "string" && !!a.sdr.trim(),
  );
  if (assignments.length === 0) {
    return NextResponse.json({ error: "Nenhuma troca informada." }, { status: 400 });
  }
  const actor = body.actor?.trim() || "Admin";
  const nowIso = new Date().toISOString();

  // Agrupa por SDR destino → 1 UPDATE por SDR (troca dono + reinicia o ciclo).
  const byTarget = new Map<string, string[]>();
  for (const a of assignments) {
    const arr = byTarget.get(a.sdr) ?? [];
    arr.push(a.leadId);
    byTarget.set(a.sdr, arr);
  }

  let updated = 0;
  for (const [sdr, ids] of byTarget) {
    const { data, error } = await admin
      .from("leads")
      .update({ sdr_responsavel: sdr, ciclo_entrada_em: nowIso })
      .in("id", ids)
      .select("id");
    if (error) {
      return NextResponse.json(
        { error: `Erro ao trocar SDR (a migração 076 já rodou?): ${error.message}`, updated },
        { status: 500 },
      );
    }
    updated += data?.length ?? 0;
  }

  // Histórico: 1 evento 'note' por lead (aparece na timeline do lead).
  const events = assignments.map((a) => ({
    lead_id: a.leadId,
    tipo: "note" as const,
    actor_name: actor,
    payload: {
      kind: "ciclo_reinicio",
      note: `Ciclo de cadência reiniciado — SDR trocado para ${a.sdr} (20 dias recomeçados; entrada original preservada)`,
      to_sdr: a.sdr,
    },
  }));
  const { error: evErr } = await admin.from("lead_events").insert(events);
  // Não falha a troca se só o log falhar — a troca em si é o que importa.
  if (evErr) return NextResponse.json({ ok: true, updated, logWarning: evErr.message });

  return NextResponse.json({ ok: true, updated });
}
