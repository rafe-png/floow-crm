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

// Normaliza telefone pra comparar formatos diferentes: só dígitos, sem o 55 do
// país, e sem o "9" extra de celular (DDD + 9XXXXXXXX → DDD + XXXXXXXX) — porque
// o Z-API às vezes reporta o número com e às vezes sem o 9.
function normPhone(p: string): string {
  let d = p.replace(/\D/g, "").replace(/^55/, "");
  if (d.length === 11 && d[2] === "9") d = d.slice(0, 2) + d.slice(3);
  return d;
}

// SDR do número que recebeu a mensagem.
// WHATSAPP_NUMBER_MAP = JSON {"<numero>":"<Nome>"} (ex: {"5511988887777":"Rafe"}).
// strict=false: sem match cai no WHATSAPP_DEFAULT_SDR (usado ao CRIAR um lead novo).
// strict=true:  sem match retorna null (usado ao REATRIBUIR — não queremos jogar
//               todo mundo no SDR padrão só porque o número não está mapeado).
function sdrForNumber(connectedPhone: string | undefined, strict: boolean): string | null {
  const raw = process.env.WHATSAPP_NUMBER_MAP;
  if (raw && connectedPhone) {
    try {
      const map = JSON.parse(raw) as Record<string, string>;
      const key = normPhone(connectedPhone);
      for (const [num, nome] of Object.entries(map)) {
        if (normPhone(num) === key) return nome;
      }
    } catch {
      // JSON inválido → cai no padrão (se não-strict)
    }
  }
  return strict ? null : (process.env.WHATSAPP_DEFAULT_SDR || "Mariana");
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

  // Lê o código entre colchetes da mensagem (numérico OU alfanumérico: [08], [C1-25], [08V2]).
  // Só vale se estiver CADASTRADO e ativo em `ad_codes` (gerenciado em Configurações).
  let criativo: number | null = null;       // código numérico (relatório de criativos)
  let criativoTxt: string | null = null;    // código cadastrado (texto), como veio no cadastro
  if (text) {
    const m = text.match(/\[\s*([A-Za-z0-9][A-Za-z0-9\-]{0,15})\s*\]/);
    if (m) {
      const raw = m[1].trim().toUpperCase();
      const { data: codes, error: codesErr } = await admin.from("ad_codes").select("code").eq("active", true);
      if (codesErr) {
        // Tabela `ad_codes` ainda não existe (migração 044 não rodou) → segurança:
        // aceita código numérico como antes, pra não parar de capturar leads.
        if (/^\d{1,3}$/.test(raw)) { criativoTxt = raw; criativo = parseInt(raw, 10); }
      } else {
        const hit = (codes ?? []).find((c) => String(c.code).trim().toUpperCase() === raw);
        if (hit) {
          criativoTxt = String(hit.code).trim();
          if (/^\d+$/.test(criativoTxt)) criativo = parseInt(criativoTxt, 10);
        }
      }
    }
  }

  // Procura lead já existente por telefone/LID (bloqueia duplicação).
  const target = normPhone(phoneRaw);
  const { data: existing } = await admin
    .from("leads")
    .select("id, telefone, criativo_codigo, criativo_codigo_txt, sdr_responsavel, status");
  const match = (existing ?? []).find((l) => l.telefone && normPhone(l.telefone as string) === target);

  if (match) {
    // Lead já existe → NÃO duplica. Só atualiza o que faz sentido:
    const patch: Record<string, unknown> = {};

    // (a) vincula o criativo se veio e ele ainda não tem (código pode chegar depois).
    if (criativo != null && (match.criativo_codigo as number | null) == null) {
      patch.criativo_codigo = criativo;
    }
    if (criativoTxt != null && (match.criativo_codigo_txt as string | null) == null) {
      patch.criativo_codigo_txt = criativoTxt;
    }

    // NÃO reatribui o SDR. A atribuição é FIXA na origem (o número que recebeu a
    // 1ª mensagem, definido na criação). Mensagens seguintes por outro número não
    // mudam o dono do lead — evita "roubar" leads entre SDRs.

    if (Object.keys(patch).length > 0) {
      const { error: upErr } = await admin.from("leads").update(patch).eq("id", match.id);
      if (upErr) {
        console.error("[whatsapp webhook] erro ao atualizar lead existente:", upErr.message);
        return NextResponse.json({ ok: false, error: upErr.message });
      }
      return NextResponse.json({ ok: true, updated: Object.keys(patch) });
    }
    return NextResponse.json({ ok: true, duplicate: true });
  }

  // Número novo: só vira lead se a mensagem trouxe um código CADASTRADO (ativo).
  // (Assim contato comum / fornecedor que manda mensagem não vira lead.)
  if (criativoTxt == null) {
    return NextResponse.json({ ok: true, skipped: "código do anúncio ausente ou não cadastrado" });
  }

  const sdr = sdrForNumber(body.connectedPhone, false);

  const { error } = await admin.from("leads").insert({
    nome: name,
    telefone: phoneRaw,
    status: "qualificado", // etapa "Entrada"
    sdr_responsavel: sdr,
    criativo_codigo: criativo,          // numérico (se o código for número)
    criativo_codigo_txt: criativoTxt,   // código cadastrado (texto)
    origem: "whatsapp",
    fonte: "meta_ads", // leads da automação vêm do anúncio (Meta Ads) por padrão
    observacoes: text ? `1ª mensagem (WhatsApp): ${text}` : "Entrou pelo WhatsApp (anúncio).",
  });

  if (error) {
    console.error("[whatsapp webhook] erro ao criar lead:", error.message);
    // 200 de propósito: evita a Z-API ficar reenviando em loop.
    return NextResponse.json({ ok: false, error: error.message });
  }

  return NextResponse.json({ ok: true, created: true });
}
