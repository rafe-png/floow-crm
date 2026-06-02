/**
 * Inicia o fluxo OAuth do Google Calendar.
 * Redireciona pra Google com os scopes necessários.
 */

import { NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabase/server";

const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const SCOPES = [
  "openid",
  "email",
  "https://www.googleapis.com/auth/calendar.events",
].join(" ");

export async function GET() {
  // Verifica que o usuário está logado no app
  const supabase = await getServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    redirect_uri: process.env.GOOGLE_REDIRECT_URI!,
    response_type: "code",
    scope: SCOPES,
    access_type: "offline",
    prompt: "consent",        // força mostrar o consent screen → garante refresh_token
    state: user.id,           // pra validar no callback
  });

  return NextResponse.redirect(`${AUTH_URL}?${params.toString()}`);
}
