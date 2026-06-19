// Build da extensão: lê as credenciais PÚBLICAS do app (.env.local), embute via
// esbuild define e gera dist/ pronto pra carregar no Chrome (modo desenvolvedor).
import { build } from "esbuild";
import { readFileSync, mkdirSync, copyFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

function readEnv(name) {
  const txt = readFileSync(resolve(root, ".env.local"), "utf8");
  const m = txt.match(new RegExp(`^${name}=(.*)$`, "m"));
  if (!m) throw new Error(`Faltando ${name} em .env.local`);
  return m[1].trim().replace(/^["']|["']$/g, "");
}

const SUPABASE_URL = readEnv("NEXT_PUBLIC_SUPABASE_URL");
const SUPABASE_ANON_KEY = readEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");

mkdirSync(resolve(__dirname, "dist"), { recursive: true });

await build({
  entryPoints: [resolve(__dirname, "src/content.ts")],
  bundle: true,
  format: "iife",
  target: "chrome114",
  outfile: resolve(__dirname, "dist/content.js"),
  define: {
    __SUPABASE_URL__: JSON.stringify(SUPABASE_URL),
    __SUPABASE_ANON_KEY__: JSON.stringify(SUPABASE_ANON_KEY),
  },
  logLevel: "info",
});

copyFileSync(resolve(__dirname, "manifest.json"), resolve(__dirname, "dist/manifest.json"));
copyFileSync(resolve(__dirname, "src/styles.css"), resolve(__dirname, "dist/styles.css"));

console.log("\n✓ Extensão construída em whatsapp-extension/dist");
console.log("  Carregue essa pasta em chrome://extensions (Modo desenvolvedor → Carregar sem compactação).");
