import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./config";

// A sessão fica em chrome.storage.local (não no localStorage do WhatsApp).
// supabase-js aceita storage assíncrono.
//
// Tudo embrulhado em try/catch: quando a extensão é atualizada mas a aba do
// WhatsApp ainda roda o script antigo, o chrome.* lança "Extension context
// invalidated". Em vez de espalhar erro, degradamos pra no-op (a aba precisa
// ser recarregada de qualquer forma).
async function safe<T>(fn: () => Promise<T> | T, fallback: T): Promise<T> {
  try {
    return await fn();
  } catch {
    return fallback;
  }
}

const chromeStorage = {
  getItem: (key: string) =>
    safe(() => chrome.storage.local.get(key).then((r) => (r[key] as string | undefined) ?? null), null),
  setItem: (key: string, value: string) => safe(() => chrome.storage.local.set({ [key]: value }), undefined),
  removeItem: (key: string) => safe(() => chrome.storage.local.remove(key), undefined),
};

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    storage: chromeStorage as any,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
  },
});
