// Cliente server-side da Meta Marketing API (Graph API). Puxa o gasto diário de
// anúncios da conta configurada. Usado só em rotas server (nunca no client — o
// token é secreto). Credenciais via env:
//   META_ACCESS_TOKEN     — token de acesso (System User, longo/permanente) com ads_read
//   META_AD_ACCOUNT_ID    — id da conta de anúncios (só os números, com ou sem "act_")
//   META_API_VERSION      — opcional, default "v21.0"

const GRAPH = "https://graph.facebook.com";

export type DailyInsight = {
  day: string; // "YYYY-MM-DD"
  spend: number;
  leads: number;
  impressions: number;
  clicks: number;
};

export type MetaConfig = { token: string; accountId: string; version: string };

/** Lê e valida as credenciais do ambiente. Lança erro amigável se faltar algo. */
export function getMetaConfig(): MetaConfig {
  const token = process.env.META_ACCESS_TOKEN?.trim();
  const rawAccount = process.env.META_AD_ACCOUNT_ID?.trim();
  if (!token) throw new Error("META_ACCESS_TOKEN não configurado no ambiente.");
  if (!rawAccount) throw new Error("META_AD_ACCOUNT_ID não configurado no ambiente.");
  const accountId = rawAccount.startsWith("act_") ? rawAccount : `act_${rawAccount}`;
  const version = process.env.META_API_VERSION?.trim() || "v21.0";
  return { token, accountId, version };
}

// Tipos de "action" da Meta que contam como lead pra nós. Anúncios de clique-para-
// WhatsApp geram "messaging_conversation_started"; formulários geram "lead".
const LEAD_ACTION_TYPES = new Set([
  "lead",
  "onsite_conversion.lead_grouped",
  "onsite_conversion.messaging_conversation_started_7d",
  "onsite_conversion.total_messaging_connection",
  "messaging_conversation_started_7d",
]);

type RawRow = {
  date_start: string;
  spend?: string;
  impressions?: string;
  clicks?: string;
  actions?: { action_type: string; value: string }[];
};

type InsightsResponse = {
  data?: RawRow[];
  paging?: { next?: string };
  error?: { message?: string };
};

function parseLeads(actions: RawRow["actions"]): number {
  if (!actions) return 0;
  let total = 0;
  for (const a of actions) {
    if (LEAD_ACTION_TYPES.has(a.action_type)) total += Number(a.value) || 0;
  }
  return total;
}

/**
 * Puxa insights diários (um registro por dia) da conta no intervalo [since, until]
 * (datas "YYYY-MM-DD", inclusivas). Segue paginação. Lança erro com a mensagem da
 * Meta se o token/conta estiverem errados.
 */
export async function fetchDailyInsights(since: string, until: string): Promise<DailyInsight[]> {
  const { token, accountId, version } = getMetaConfig();
  const params = new URLSearchParams({
    level: "account",
    time_increment: "1",
    fields: "spend,impressions,clicks,actions",
    time_range: JSON.stringify({ since, until }),
    limit: "500",
    access_token: token,
  });

  let url: string | null = `${GRAPH}/${version}/${accountId}/insights?${params.toString()}`;
  const out: DailyInsight[] = [];

  // Segue "paging.next" até acabar (cada página traz até `limit` dias).
  while (url) {
    const res: Response = await fetch(url, { cache: "no-store" });
    const json = (await res.json()) as InsightsResponse;
    if (!res.ok) {
      const msg = json?.error?.message || `Erro ${res.status} na Meta API`;
      throw new Error(msg);
    }
    for (const row of json.data ?? []) {
      out.push({
        day: row.date_start,
        spend: Number(row.spend) || 0,
        leads: parseLeads(row.actions),
        impressions: Number(row.impressions) || 0,
        clicks: Number(row.clicks) || 0,
      });
    }
    url = json.paging?.next ?? null;
  }

  return out;
}
