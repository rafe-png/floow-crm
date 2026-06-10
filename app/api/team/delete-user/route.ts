import { NextResponse } from "next/server";
import { getAdminSupabaseGuard } from "../guard";
import { isAdminEmail } from "@/lib/types";

export async function POST(request: Request) {
  const guard = await getAdminSupabaseGuard();
  if (!guard.ok) return guard.response;
  const admin = guard.admin;

  let body: { id?: string; email?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }

  const { id, email } = body;
  if (!id) return NextResponse.json({ error: "id obrigatório." }, { status: 400 });

  // Nunca remover o próprio admin.
  if (isAdminEmail(email)) {
    return NextResponse.json({ error: "Não é possível remover o admin." }, { status: 400 });
  }

  // 1) Desativa no time (some dos forms; histórico de leads é preservado).
  const { error: teamErr } = await admin.from("team_members").update({ active: false }).eq("id", id);
  if (teamErr) {
    return NextResponse.json({ error: `Erro ao desativar: ${teamErr.message}` }, { status: 400 });
  }

  // 2) Remove a conta de login (impede acesso). Busca o id do auth pelo email.
  if (email) {
    const { data: list } = await admin.auth.admin.listUsers({ perPage: 1000 });
    const authUser = list?.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
    if (authUser) await admin.auth.admin.deleteUser(authUser.id);
  }

  return NextResponse.json({ ok: true });
}
