"use client";

import { Suspense, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getSupabase } from "@/lib/supabase/client";

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") || "/";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const supabase = getSupabase();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setError(error.message);
      return;
    }

    startTransition(() => {
      router.replace(next);
      router.refresh();
    });
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0a0a0a] px-4">
      <div className="w-full max-w-sm rounded-2xl border border-zinc-900 bg-zinc-950 p-8 shadow-2xl">
        <div className="mb-6 flex flex-col items-center gap-2">
          <span className="text-4xl font-bold leading-none text-[#f5c518]">∞</span>
          <h1 className="text-lg font-bold text-zinc-100">floow CRM</h1>
          <p className="text-xs text-zinc-500">Acesso interno</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-400">Email</label>
            <input
              type="email"
              required
              autoFocus
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="ds-auth-input"
              placeholder="seu@email.com"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-400">Senha</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="ds-auth-input"
              placeholder="••••••••"
            />
          </div>

          {error && (
            <div className="rounded-md border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-300">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={pending}
            className="w-full rounded-md bg-[#f5c518] px-4 py-2 text-sm font-semibold text-zinc-950 hover:bg-[#ffd633] disabled:opacity-50"
          >
            {pending ? "Entrando…" : "Entrar"}
          </button>
        </form>

        <p className="mt-6 text-center text-[10px] text-zinc-600">
          Esqueceu a senha? Peça pra resetar no painel do Supabase.
        </p>
      </div>

      <style jsx>{`
        .ds-auth-input {
          width: 100%;
          background: #0f1218;
          border: 1px solid #2a2f3a;
          border-radius: 6px;
          padding: 8px 12px;
          color: #e7e9ee;
          font-size: 14px;
          outline: none;
          transition: border-color 0.15s;
        }
        .ds-auth-input:focus { border-color: #f5c518; }
      `}</style>
    </div>
  );
}
