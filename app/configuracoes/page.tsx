"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AlertCircle, Check, ExternalLink, LogOut } from "lucide-react";
import { TopBar } from "@/components/layout/TopBar";
import { getSupabase } from "@/lib/supabase/client";

export default function ConfiguracoesPage() {
  return (
    <Suspense fallback={null}>
      <ConfiguracoesContent />
    </Suspense>
  );
}

function ConfiguracoesContent() {
  const params = useSearchParams();
  const connectedParam = params.get("connected");
  const errorParam = params.get("error");

  const [status, setStatus] = useState<{ connected: boolean; email: string | null } | null>(null);
  const [authUserEmail, setAuthUserEmail] = useState<string | null>(null);
  const [loadingDisconnect, setLoadingDisconnect] = useState(false);

  useEffect(() => {
    fetch("/api/calendar/status")
      .then((r) => r.json())
      .then((d) => setStatus(d))
      .catch(() => setStatus({ connected: false, email: null }));

    getSupabase()
      .auth.getUser()
      .then(({ data }) => setAuthUserEmail(data.user?.email ?? null));
  }, [connectedParam]);

  async function handleDisconnect() {
    if (!confirm("Desconectar a agenda do Google? Eventos futuros não serão criados.")) return;
    setLoadingDisconnect(true);
    try {
      await fetch("/api/auth/google/disconnect", { method: "POST" });
      setStatus({ connected: false, email: null });
    } finally {
      setLoadingDisconnect(false);
    }
  }

  async function handleLogout() {
    await getSupabase().auth.signOut();
    window.location.href = "/login";
  }

  return (
    <>
      <TopBar title="Configurações" />
      <main className="flex-1 overflow-y-auto px-4 py-6 sm:px-6">
        <div className="mx-auto max-w-2xl space-y-6">
          {/* Banners de feedback do OAuth */}
          {connectedParam && (
            <Banner kind="success">
              <Check size={14} />
              Agenda conectada{connectedParam !== "ok" ? ` como ${connectedParam}` : ""}.
            </Banner>
          )}
          {errorParam && (
            <Banner kind="error">
              <AlertCircle size={14} />
              Erro ao conectar: {errorParam}
            </Banner>
          )}

          {/* Card Google Calendar */}
          <Card title="Google Agenda" subtitle="1 agenda compartilhada para todos os usuários do CRM">
            {status === null ? (
              <p className="text-xs text-zinc-500">Carregando…</p>
            ) : status.connected ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm text-emerald-300">
                  <Check size={14} />
                  Conectado{status.email ? ` · ${status.email}` : ""}
                </div>
                <p className="text-xs text-zinc-500">
                  Todo lead criado/editado com data de agendamento gera evento no Google Calendar
                  com link do Meet incluso.
                </p>
                <button
                  onClick={handleDisconnect}
                  disabled={loadingDisconnect}
                  className="rounded-md border border-rose-500/40 bg-rose-500/10 px-3 py-1.5 text-xs font-medium text-rose-300 hover:bg-rose-500/20 disabled:opacity-50"
                >
                  Desconectar agenda
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-zinc-300">
                  Conecte uma conta Google. Os eventos das reuniões agendadas no CRM vão pra esta
                  agenda, e o link do Meet é gerado automaticamente.
                </p>
                <a
                  href="/api/auth/google"
                  className="inline-flex items-center gap-2 rounded-md bg-[#1a73e8] px-4 py-2 text-sm font-semibold text-white hover:bg-[#1557b0]"
                >
                  <ExternalLink size={14} />
                  Conectar Google Agenda
                </a>
              </div>
            )}
          </Card>

          {/* Conta */}
          <Card title="Conta" subtitle="Sessão atual">
            {authUserEmail && (
              <div className="mb-3 text-sm text-zinc-300">
                Logado como <span className="font-medium text-zinc-100">{authUserEmail}</span>
              </div>
            )}
            <button
              onClick={handleLogout}
              className="inline-flex items-center gap-1.5 rounded-md border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-xs text-zinc-300 hover:border-zinc-700 hover:text-zinc-100"
            >
              <LogOut size={12} />
              Sair
            </button>
          </Card>
        </div>
      </main>
    </>
  );
}

function Card({
  title, subtitle, children,
}: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-zinc-900 bg-zinc-950/60 p-5">
      <header className="mb-4">
        <h2 className="text-sm font-semibold text-zinc-100">{title}</h2>
        {subtitle && <p className="text-xs text-zinc-500">{subtitle}</p>}
      </header>
      {children}
    </section>
  );
}

function Banner({ kind, children }: { kind: "success" | "error"; children: React.ReactNode }) {
  const cls =
    kind === "success"
      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
      : "border-rose-500/30 bg-rose-500/10 text-rose-300";
  return (
    <div className={`flex items-center gap-2 rounded-md border px-3 py-2 text-xs ${cls}`}>
      {children}
    </div>
  );
}
