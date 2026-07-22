/**
 * POST /api/ext/send-audio
 * Usada pela EXTENSÃO: envia um áudio "pronto" da biblioteca pro número do lead,
 * pela instância do Z-API do SDR logado. Chega como áudio novo (voice note), não
 * como "encaminhado". Manda uma VARIANTE aleatória do snippet (anti-spam).
 *
 * Auth: Authorization: Bearer <access_token do Supabase> (identifica o SDR).
 * Body: { snippetId: string, phone: string (só dígitos, com 55) }
 *
 * Config (env) ZAPI_INSTANCES = JSON:
 *   { "Rafe":   { "instanceId": "...", "token": "...", "clientToken": "..." },
 *     "Mariana":{ "instanceId": "...", "token": "...", "clientToken": "..." } }
 */
import { NextResponse, type NextRequest } from "next/server";
import { getAdminSupabase } from "@/lib/supabase/server";

export const runtime = "nodejs";

// A extensão chama daqui de web.whatsapp.com (origem diferente) → precisa de CORS.
// Auth é por Bearer token (não cookie), então liberar "*" é seguro.
const CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type",
  "Access-Control-Max-Age": "86400",
};

function reply(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: CORS });
}

// Preflight.
export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

// clientToken é OPCIONAL: só é exigido se o "Token de segurança da conta" estiver
// ativado no painel do Z-API. Inativo → não manda o header.
type Instance = { instanceId: string; token: string; clientToken?: string };

function instanceForSdr(name: string | null): Instance | null {
  const raw = process.env.ZAPI_INSTANCES;
  if (!raw || !name) return null;
  try {
    const map = JSON.parse(raw) as Record<string, Instance>;
    return map[name] ?? null;
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();
  if (!token) return reply({ ok: false, error: "sem token" }, 401);

  const admin = getAdminSupabase();
  const { data: { user }, error: authErr } = await admin.auth.getUser(token);
  if (authErr || !user) return reply({ ok: false, error: "não autenticado" }, 401);

  let snippetId: string | undefined;
  let phone: string | undefined;
  try {
    ({ snippetId, phone } = (await req.json()) as { snippetId?: string; phone?: string });
  } catch {
    return reply({ ok: false, error: "body inválido" }, 400);
  }
  const digits = (phone || "").replace(/\D/g, "");
  if (!snippetId || !digits) {
    return reply({ ok: false, error: "snippetId e phone são obrigatórios" }, 400);
  }

  // Quem é o SDR (pra saber por qual número/instância enviar).
  const { data: member } = await admin
    .from("team_members")
    .select("name")
    .eq("email", user.email)
    .maybeSingle();
  const sdrName = (member?.name as string) ?? null;
  const inst = instanceForSdr(sdrName);
  if (!inst) {
    return reply(
      { ok: false, error: `Sem instância do Z-API configurada pra "${sdrName ?? "usuário"}".` },
      400,
    );
  }

  // Snippet + variante aleatória (rotação anti-spam).
  const { data: snippet } = await admin
    .from("audio_snippets")
    .select("name, urls, active, owner")
    .eq("id", snippetId)
    .maybeSingle();
  const urls: string[] = (snippet?.urls as string[]) ?? [];
  if (!snippet || snippet.active === false || urls.length === 0) {
    return reply({ ok: false, error: "áudio não encontrado ou sem variantes" }, 404);
  }
  // Áudio com dono só pode ser enviado por esse dono (null = todos).
  if (snippet.owner && snippet.owner !== sdrName) {
    return reply({ ok: false, error: "esse áudio não é seu" }, 403);
  }
  // Sem Math.random no client, mas aqui é server: escolhe uma variante.
  const audioUrl = urls[Math.floor(Math.random() * urls.length)];

  // Envia pelo Z-API (send-audio → voice note, sem "encaminhado").
  const url = `https://api.z-api.io/instances/${inst.instanceId}/token/${inst.token}/send-audio`;
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (inst.clientToken) headers["Client-Token"] = inst.clientToken; // só se ativado
  try {
    const res = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify({ phone: digits, audio: audioUrl }),
    });
    const zapi = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg = (zapi as { error?: string; message?: string })?.error
        || (zapi as { message?: string })?.message
        || `Z-API respondeu ${res.status}`;
      console.error("[send-audio] Z-API erro:", msg);
      return reply({ ok: false, error: msg }, 502);
    }
    return reply({ ok: true, sentFrom: sdrName });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Falha ao enviar áudio.";
    return reply({ ok: false, error: msg }, 502);
  }
}
