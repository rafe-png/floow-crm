/**
 * Callback do OAuth do Google. Troca code → tokens, salva em google_credentials,
 * e redireciona pra /configuracoes.
 */

import { NextResponse, type NextRequest } from "next/server";
import { getServerSupabase } from "@/lib/supabase/server";
import { exchangeCodeForTokens } from "@/lib/google/calendar";

export async function GET(req: NextRequest) {
  const supabase = await getServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  const error = req.nextUrl.searchParams.get("error");

  if (error) {
    return NextResponse.redirect(
      new URL(`/configuracoes?error=${encodeURIComponent(error)}`, req.url),
    );
  }
  if (!code || state !== user.id) {
    return NextResponse.redirect(
      new URL("/configuracoes?error=invalid_callback", req.url),
    );
  }

  const result = await exchangeCodeForTokens(code, process.env.GOOGLE_REDIRECT_URI!);
  if (!result) {
    return NextResponse.redirect(
      new URL("/configuracoes?error=token_exchange_failed", req.url),
    );
  }

  return NextResponse.redirect(
    new URL(`/configuracoes?connected=${encodeURIComponent(result.email ?? "ok")}`, req.url),
  );
}
