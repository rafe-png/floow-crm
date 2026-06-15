import { NextResponse } from "next/server";
import { getAdminSupabase } from "@/lib/supabase/server";

export const runtime = "nodejs";

// Payload do webhook "Ao receber" da Z-API (campos que usamos).
type ZApiBody = {
  fromMe?: boolean;
  isGroup?: boolean;
  isNewsletter?: boolean;
  phone?: string;
  senderName?: string;
  chatName?: string;
  text?: { message?: string };
};

// Só dígitos, sem o 55 do país — pra comparar telefones em formatos diferentes.
function normPhone(p: string): string {
  return p.replace(/\D/g, "").replace(/^55/, "");
}

// Confere se o segredo bate (vem na URL: ?token=...).
function authorized(request: Request): boolean {
  const secret = process.env.WHATSAPP_WEBHOOK_SECRET;
  if (!secret) return false;
  const token = new URL(request.url).searchParams.get("token");
  return token === secret;
}

export async function GET(request: Request) {
  // Pra você testar a URL no navegador.
  if (!authorized(request)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return NextResponse.json({ ok: true, hint: "Webhook do WhatsApp ativo. A Z-API deve fazer POST aqui." });
}

export async function POST(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: ZApiBody;
  try {
    body = (await request.json()) as ZApiBody;
  } catch {
    return NextResponse.json({ ok: true, skipped: "json inválido" });
  }

  // Ignora: mensagens enviadas por nós, grupos, newsletters, e sem telefone.
  const phoneRaw = body.phone?.trim();
  if (body.fromMe || body.isGroup || body.isNewsletter || !phoneRaw) {
    return NextResponse.json({ ok: true, skipped: true });
  }

  const text = body.text?.message?.trim() || null;
  const name = (body.senderName || body.chatName || "").trim() || phoneRaw;

  const admin = getAdminSupabase();

  // Dedupe por telefone: se já existe lead com esse número, não cria de novo.
  const target = normPhone(phoneRaw);
  const { data: existing } = await admin.from("leads").select("id, telefone");
  const dup = (existing ?? []).some((l) => l.telefone && normPhone(l.telefone as string) === target);
  if (dup) return NextResponse.json({ ok: true, duplicate: true });

  // Lê o código do criativo [NN] da 1ª mensagem (ex: "[01] Olá...").
  let criativo: number | null = null;
  if (text) {
    const m = text.match(/\[\s*(\d{1,3})\s*\]/);
    if (m) criativo = parseInt(m[1], 10);
  }

  const sdr = process.env.WHATSAPP_DEFAULT_SDR || "Mariana";

  const { error } = await admin.from("leads").insert({
    nome: name,
    telefone: phoneRaw,
    dono: "SDR",
    status: "qualificado", // etapa "Entrada"
    sdr_responsavel: sdr,
    criativo_codigo: criativo,
    origem: "whatsapp",
    observacoes: text ? `1ª mensagem (WhatsApp): ${text}` : "Entrou pelo WhatsApp (anúncio).",
  });

  if (error) {
    console.error("[whatsapp webhook] erro ao criar lead:", error.message);
    // 200 de propósito: evita a Z-API ficar reenviando em loop.
    return NextResponse.json({ ok: false, error: error.message });
  }

  return NextResponse.json({ ok: true, created: true });
}
