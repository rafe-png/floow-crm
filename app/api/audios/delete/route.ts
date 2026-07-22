/**
 * POST /api/audios/delete  (admin)
 * Remove um snippet e (best-effort) apaga os arquivos do Storage.
 * Body: { id: string }
 */
import { NextResponse } from "next/server";
import { getAdminSupabaseGuard } from "@/app/api/team/guard";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const guard = await getAdminSupabaseGuard();
  if (!guard.ok) return guard.response;
  const { admin } = guard;

  let id: string | undefined;
  try {
    ({ id } = (await req.json()) as { id?: string });
  } catch {
    return NextResponse.json({ error: "body inválido" }, { status: 400 });
  }
  if (!id) return NextResponse.json({ error: "id obrigatório" }, { status: 400 });

  // Pega as URLs antes de apagar (pra limpar o Storage também).
  const { data: snip } = await admin.from("audio_snippets").select("urls").eq("id", id).maybeSingle();

  const { error } = await admin.from("audio_snippets").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Best-effort: apaga os arquivos do bucket 'audios' (não bloqueia se falhar).
  const urls = (snip?.urls as string[]) ?? [];
  const paths = urls
    .map((u) => {
      const after = u.split("/audios/")[1];
      return after ? decodeURIComponent(after) : null;
    })
    .filter((p): p is string => !!p);
  if (paths.length) {
    await admin.storage.from("audios").remove(paths);
  }

  return NextResponse.json({ ok: true });
}
