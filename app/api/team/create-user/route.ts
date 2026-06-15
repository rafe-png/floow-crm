import { NextResponse } from "next/server";
import { getAdminSupabaseGuard } from "../guard";
import type { TeamRole } from "@/lib/types";

export async function POST(request: Request) {
  const guard = await getAdminSupabaseGuard();
  if (!guard.ok) return guard.response;
  const admin = guard.admin;

  let body: { name?: string; email?: string; password?: string; role?: TeamRole };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }

  const name = body.name?.trim();
  const email = body.email?.trim().toLowerCase();
  const password = body.password ?? "";
  const role = body.role;

  if (!name || !email || !password || (role !== "SDR" && role !== "Closer" && role !== "Trafego")) {
    return NextResponse.json(
      { error: "Preencha nome, email, senha e função (SDR, Closer ou Gestor de tráfego)." },
      { status: 400 },
    );
  }
  if (password.length < 6) {
    return NextResponse.json({ error: "A senha precisa ter pelo menos 6 caracteres." }, { status: 400 });
  }

  // 1) Cria a conta de login (já confirmada — sem precisar de email/SMTP).
  const { data: created, error: authErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (authErr) {
    return NextResponse.json({ error: `Erro ao criar login: ${authErr.message}` }, { status: 400 });
  }

  // 2) Registra no time. Pra não duplicar membros já existentes (ex: Mariana
  // já cadastrada), vincula a linha existente quando dá; senão insere.
  const { data: existing } = await admin
    .from("team_members")
    .select("id, email")
    .eq("active", true)
    .or(`email.eq.${email},and(name.ilike.${name},role.eq.${role})`);

  const linkable = existing?.find((m) => !m.email || m.email.toLowerCase() === email);

  let teamErr;
  if (linkable) {
    ({ error: teamErr } = await admin
      .from("team_members")
      .update({ name, role, email })
      .eq("id", linkable.id));
  } else {
    ({ error: teamErr } = await admin.from("team_members").insert({ name, role, email }));
  }

  if (teamErr) {
    // Rollback do auth pra não deixar conta órfã.
    if (created.user) await admin.auth.admin.deleteUser(created.user.id);
    return NextResponse.json({ error: `Erro ao salvar no time: ${teamErr.message}` }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
