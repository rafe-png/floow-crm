import { NextResponse } from "next/server";
import { getAdminSupabase } from "@/lib/supabase/server";

export const runtime = "nodejs";

// Payload do webhook "Ao receber" da Z-API (campos que usamos).
type ZApiBody = {
  fromMe?: boolean;
  isGroup?: boolean;
  isNewsletter?: boolean;
  phone?: string;          // telefone de quem mandou
  connectedPhone?: string; // o NOSSO número que recebeu (define o responsável)
  instanceId?: string;     // id da instância Z-API (alternativa de roteamento)
  senderName?: string;
  chatName?: string;
  text?: { message?: string };
};

// Só dígitos, sem o 55 do país — pra comparar telefones em formatos diferentes.
function normPhone(p: string): string {
  return p.replace(/\D/g, "").replace(/^55/, "");
}

// Responsável do lead conforme o número que recebeu a mensagem.
// WHATSAPP_NUMBER_MAP = JSON {"<numero>":"<Nome>"} (ex: {"5511988887777":"Rafe"}).
// Sem match → WHATSAPP_DEFAULT_SDR (padrão "Mariana").
function responsavelForNumber(connectedPhone: string | undefined): string {
  const def = process.env.WHATSAPP_DEFAULT_SDR || "Mariana";
  const raw = process.env.WHATSAPP_NUMBER_MAP;
  if (!raw || !connectedPhone) return def;
  try {
    const map = JSON.parse(raw) as Record<string, string>;
    const key = normPhone(connectedPhone);
    for (const [num, nome] of Object.entries(map)) {
      if (normPhone(num) === key) return nome;
    }
  } catch {
    // JSON inválido → cai no padrão
  }
  return def;
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

  // DIAGNÓSTICO (compacto, valores de roteamento primeiro pra não truncar).
  console.log(
    "[wh]",
    "cp=" + (body.connectedPhone ?? "null"),
    "inst=" + (body.instanceId ?? "null"),
    "ph=" + (body.phone ?? "null"),
    "fromMe=" + (body.fromMe ?? "null"),
    "txt=" + (body.text?.message?.slice(0, 22) ?? "null"),
  );

  // Ignora: mensagens enviadas por nós, grupos, newsletters, e sem telefone.
  const phoneRaw = body.phone?.trim();
  if (body.fromMe || body.isGroup || body.isNewsletter || !phoneRaw) {
    return NextResponse.json({ ok: true, skipped: true });
  }

  const text = body.text?.message?.trim() || null;
  const name = (body.senderName || body.chatName || "").trim() || phoneRaw;

  const admin = getAdminSupabase();

  // Lê o código do criativo [NN] de QUALQUER mensagem (ex: "[7]", "[07]", "[100]").
  let criativo: number | null = null;
  if (text) {
    const m = text.match(/\[\s*(\d{1,3})\s*\]/);
    if (m) criativo = parseInt(m[1], 10);
  }

  // Procura lead já existente por telefone.
  const target = normPhone(phoneRaw);
  const { data: existing } = await admin.from("leads").select("id, telefone, criativo_codigo");
  const match = (existing ?? []).find((l) => l.telefone && normPhone(l.telefone as string) === target);

  if (match) {
    // Lead já existe: se veio código e ele ainda não tem, vincula o criativo
    // (o código pode chegar numa mensagem posterior, não só na primeira).
    if (criativo != null && (match.criativo_codigo as number | null) == null) {
      const { error: upErr } = await admin
        .from("leads")
        .update({ criativo_codigo: criativo })
        .eq("id", match.id);
      if (upErr) {
        console.error("[whatsapp webhook] erro ao vincular criativo:", upErr.message);
        return NextResponse.json({ ok: false, error: upErr.message });
      }
      return NextResponse.json({ ok: true, linkedCreative: criativo });
    }
    return NextResponse.json({ ok: true, duplicate: true });
  }

  // Número novo: só vira lead se a mensagem trouxe o código do anúncio [NN].
  // (Assim contato comum / fornecedor que manda mensagem não vira lead.)
  if (criativo == null) {
    return NextResponse.json({ ok: true, skipped: "sem código do anúncio" });
  }

  const sdr = responsavelForNumber(body.connectedPhone);

  const { error } = await admin.from("leads").insert({
    nome: name,
    telefone: phoneRaw,
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
