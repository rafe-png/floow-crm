// Valores injetados no build (esbuild define) a partir do .env.local do app.
// A chave anon/publishable é pública por design (protegida por RLS no banco).
declare const __SUPABASE_URL__: string;
declare const __SUPABASE_ANON_KEY__: string;

export const SUPABASE_URL = __SUPABASE_URL__;
export const SUPABASE_ANON_KEY = __SUPABASE_ANON_KEY__;
export const APP_URL = "https://crm.floowdigital.com";
export const ADMIN_EMAIL = "rafe@floowdigital.com";
