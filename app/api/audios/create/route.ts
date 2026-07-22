/**
 * POST /api/audios/create  (admin)
 * Cria um snippet de áudio na biblioteca. As URLs já vêm prontas (o upload dos
 * arquivos pro Storage acontece no client, na tela /audios).
 * Body: { name, emoji?, owner?, urls: string[] }  (owner null/vazio = Todos)
 */
import { NextResponse } from "next/server";
import { getAdminSupabaseGuard } from "@/app/api/team/guard";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const guard = await getAdminSupabaseGuard();
  if (!guard.ok) return guard.response;
  const { admin } = guard;

  let body: { name?: string; emoji?: string | null; owner?: string | null; urls?: string[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "body inválido" }, { status: 400 });
  }

  const name = (body.name || "").trim();
  const urls = (body.urls || []).filter((u) => typeof u === "string" && u.length > 0);
  if (!name || urls.length === 0) {
    return NextResponse.json({ error: "Nome e ao menos 1 áudio são obrigatórios." }, { status: 400 });
  }
  const owner = body.owner?.trim() || null; // null = todos
  const emoji = body.emoji?.trim() || null;

  const { count } = await admin.from("audio_snippets").select("id", { count: "exact", head: true });

  const { data, error } = await admin
    .from("audio_snippets")
    .insert({ name, emoji, owner, urls, ordem: count ?? 0, active: true })
    .select("id")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, id: data.id });
}
