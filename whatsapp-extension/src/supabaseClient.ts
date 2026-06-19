import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./config";

// A sessão fica em chrome.storage.local (não no localStorage do WhatsApp).
// supabase-js aceita storage assíncrono.
const chromeStorage = {
  getItem: (key: string) =>
    chrome.storage.local.get(key).then((r) => (r[key] as string | undefined) ?? null),
  setItem: (key: string, value: string) => chrome.storage.local.set({ [key]: value }),
  removeItem: (key: string) => chrome.storage.local.remove(key),
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
