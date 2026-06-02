/**
 * Cliente do Google Calendar — usado APENAS server-side (API routes).
 * Gerencia refresh de access_token e chamadas REST à API do Calendar.
 */

import { getAdminSupabase } from "@/lib/supabase/server";

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const CAL_API = "https://www.googleapis.com/calendar/v3";

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID!;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET!;

type GoogleCredentials = {
  id: string;
  access_token: string;
  refresh_token: string;
  expires_at: string;
  email: string | null;
  calendar_id: string;
};

export async function getValidCredentials(): Promise<GoogleCredentials | null> {
  const supabase = getAdminSupabase();
  const { data, error } = await supabase
    .from("google_credentials")
    .select("*")
    .eq("id", "singleton")
    .maybeSingle();

  if (error || !data) return null;

  const creds = data as GoogleCredentials;
  const now = new Date();
  const expiresAt = new Date(creds.expires_at);
  // Refresh se expirar nos próximos 60s
  if (expiresAt.getTime() - now.getTime() < 60_000) {
    return await refreshAccessToken(creds);
  }
  return creds;
}

async function refreshAccessToken(creds: GoogleCredentials): Promise<GoogleCredentials | null> {
  const body = new URLSearchParams({
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    refresh_token: creds.refresh_token,
    grant_type: "refresh_token",
  });

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!res.ok) {
    console.error("Falha ao refresh do token Google:", await res.text());
    return null;
  }

  const json = (await res.json()) as {
    access_token: string;
    expires_in: number;
    scope?: string;
    token_type?: string;
  };

  const expiresAt = new Date(Date.now() + (json.expires_in - 30) * 1000).toISOString();

  const supabase = getAdminSupabase();
  await supabase
    .from("google_credentials")
    .update({
      access_token: json.access_token,
      expires_at: expiresAt,
      updated_at: new Date().toISOString(),
    })
    .eq("id", "singleton");

  return { ...creds, access_token: json.access_token, expires_at: expiresAt };
}

/**
 * Troca o `code` do OAuth callback por access_token + refresh_token e salva.
 */
export async function exchangeCodeForTokens(code: string, redirectUri: string): Promise<{ email?: string } | null> {
  const body = new URLSearchParams({
    code,
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    redirect_uri: redirectUri,
    grant_type: "authorization_code",
  });

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!res.ok) {
    console.error("Falha ao trocar code por tokens:", await res.text());
    return null;
  }

  const json = (await res.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in: number;
    scope: string;
    id_token?: string;
  };

  if (!json.refresh_token) {
    // Sem refresh_token = usuário já autorizou antes. Force prompt=consent na próxima autorização.
    console.warn("Sem refresh_token — Google já autorizou antes. Use prompt=consent.");
  }

  // Extrai email do id_token (sem verificar assinatura — é só pra exibir)
  let email: string | undefined;
  if (json.id_token) {
    try {
      const payload = JSON.parse(
        Buffer.from(json.id_token.split(".")[1], "base64").toString("utf-8"),
      );
      email = payload.email;
    } catch {}
  }

  const expiresAt = new Date(Date.now() + (json.expires_in - 30) * 1000).toISOString();

  const supabase = getAdminSupabase();
  const { error: upsertErr } = await supabase.from("google_credentials").upsert(
    {
      id: "singleton",
      access_token: json.access_token,
      refresh_token: json.refresh_token || "",
      expires_at: expiresAt,
      email: email ?? null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "id" },
  );
  if (upsertErr) {
    console.error("[google/calendar] upsert google_credentials FAILED:", upsertErr);
    return null;
  }
  console.log("[google/calendar] credentials saved for", email);

  return { email };
}

// ============================================================
// API do Calendar
// ============================================================

type CalendarEvent = {
  id: string;
  summary?: string;
  description?: string;
  hangoutLink?: string;
  htmlLink?: string;
  start?: { dateTime?: string };
  end?: { dateTime?: string };
  conferenceData?: {
    entryPoints?: { entryPointType: string; uri: string }[];
  };
};

type CreateEventInput = {
  summary: string;
  description?: string;
  startIso: string;
  endIso: string;
  attendees?: { email: string }[];
};

export async function createEvent(input: CreateEventInput): Promise<{
  eventId: string;
  meetLink: string | null;
  htmlLink: string | null;
} | null> {
  const creds = await getValidCredentials();
  if (!creds) return null;

  const body = {
    summary: input.summary,
    description: input.description ?? "",
    start: { dateTime: input.startIso, timeZone: "America/Sao_Paulo" },
    end: { dateTime: input.endIso, timeZone: "America/Sao_Paulo" },
    attendees: input.attendees,
    conferenceData: {
      createRequest: {
        requestId: `floow-${Date.now()}`,
        conferenceSolutionKey: { type: "hangoutsMeet" },
      },
    },
  };

  const url = `${CAL_API}/calendars/${encodeURIComponent(creds.calendar_id)}/events?conferenceDataVersion=1`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${creds.access_token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    console.error("Falha ao criar evento:", await res.text());
    return null;
  }

  const ev = (await res.json()) as CalendarEvent;
  const meetLink =
    ev.hangoutLink ??
    ev.conferenceData?.entryPoints?.find((p) => p.entryPointType === "video")?.uri ??
    null;
  return { eventId: ev.id, meetLink, htmlLink: ev.htmlLink ?? null };
}

export async function updateEvent(eventId: string, input: Partial<CreateEventInput>): Promise<{
  meetLink: string | null;
} | null> {
  const creds = await getValidCredentials();
  if (!creds) return null;

  const patch: Record<string, unknown> = {};
  if (input.summary != null) patch.summary = input.summary;
  if (input.description != null) patch.description = input.description;
  if (input.startIso) patch.start = { dateTime: input.startIso, timeZone: "America/Sao_Paulo" };
  if (input.endIso) patch.end = { dateTime: input.endIso, timeZone: "America/Sao_Paulo" };

  const url = `${CAL_API}/calendars/${encodeURIComponent(creds.calendar_id)}/events/${encodeURIComponent(eventId)}?conferenceDataVersion=1`;
  const res = await fetch(url, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${creds.access_token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(patch),
  });

  if (!res.ok) {
    console.error("Falha ao atualizar evento:", await res.text());
    return null;
  }

  const ev = (await res.json()) as CalendarEvent;
  const meetLink =
    ev.hangoutLink ??
    ev.conferenceData?.entryPoints?.find((p) => p.entryPointType === "video")?.uri ??
    null;
  return { meetLink };
}

export async function deleteEvent(eventId: string): Promise<boolean> {
  const creds = await getValidCredentials();
  if (!creds) return false;

  const url = `${CAL_API}/calendars/${encodeURIComponent(creds.calendar_id)}/events/${encodeURIComponent(eventId)}`;
  const res = await fetch(url, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${creds.access_token}` },
  });

  return res.ok || res.status === 410; // 410 = já deletado
}

export async function getConnectionInfo(): Promise<{ connected: boolean; email: string | null }> {
  const supabase = getAdminSupabase();
  const { data, error } = await supabase
    .from("google_credentials")
    .select("email")
    .eq("id", "singleton")
    .maybeSingle();
  if (error) {
    console.error("[google/calendar] getConnectionInfo FAILED:", error);
  } else {
    console.log("[google/calendar] getConnectionInfo data:", data);
  }
  return { connected: !!data, email: data?.email ?? null };
}

export async function disconnect(): Promise<void> {
  const supabase = getAdminSupabase();
  await supabase.from("google_credentials").delete().eq("id", "singleton");
}
