import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

// /api/ext/* autentica por bearer token (extensão do WhatsApp), não por cookie.
// /api/meta/sync autentica por CRON_SECRET (cron) ou sessão de admin (checada
// dentro da rota) — fica fora do redirect de login.
const PUBLIC_PATHS = ["/login", "/api/auth", "/api/webhooks", "/api/cron", "/api/ext", "/api/meta"];

export async function middleware(request: NextRequest) {
  // Domínio oficial: redireciona o endereço antigo (.vercel.app) pro domínio
  // próprio. Só o alias fixo de produção — previews (floow-<hash>.vercel.app)
  // continuam funcionando normalmente.
  const host = request.headers.get("host") || "";
  if (host === "floow-crm.vercel.app" && !request.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.redirect(
      new URL(request.nextUrl.pathname + request.nextUrl.search, "https://crm.floowdigital.com"),
      308,
    );
  }

  const response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(toSet) {
          for (const { name, value } of toSet) {
            request.cookies.set(name, value);
          }
          for (const { name, value, options } of toSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  const { data: { user } } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isPublic = PUBLIC_PATHS.some((p) => path === p || path.startsWith(p + "/"));

  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", path);
    return NextResponse.redirect(url);
  }

  if (user && path === "/login") {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all paths exceto:
     * - _next/static, _next/image, favicon, public assets
     */
    "/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
