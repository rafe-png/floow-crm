import { NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabase/server";
import { disconnect } from "@/lib/google/calendar";

export async function POST() {
  const supabase = await getServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  await disconnect();
  return NextResponse.json({ ok: true });
}
