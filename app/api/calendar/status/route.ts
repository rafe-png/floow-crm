import { NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabase/server";
import { getConnectionInfo } from "@/lib/google/calendar";

export async function GET() {
  const supabase = await getServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const info = await getConnectionInfo();
  return NextResponse.json(info);
}
