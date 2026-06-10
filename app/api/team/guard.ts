import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getServerSupabase, getAdminSupabase } from "@/lib/supabase/server";
import { isAdminEmail } from "@/lib/types";

type GuardResult =
  | { ok: true; admin: SupabaseClient }
  | { ok: false; response: NextResponse };

/**
 * Garante que o chamador está logado E é o admin do CRM.
 * Em caso positivo devolve um client service_role pra operações admin.
 */
export async function getAdminSupabaseGuard(): Promise<GuardResult> {
  const supabase = await getServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, response: NextResponse.json({ error: "Não autenticado." }, { status: 401 }) };
  }
  if (!isAdminEmail(user.email)) {
    return { ok: false, response: NextResponse.json({ error: "Sem permissão." }, { status: 403 }) };
  }

  return { ok: true, admin: getAdminSupabase() };
}
