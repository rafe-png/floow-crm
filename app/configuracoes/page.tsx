"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AlertCircle, Check, ExternalLink, LogOut, X } from "lucide-react";
import { TopBar } from "@/components/layout/TopBar";
import { useTeamContext } from "@/lib/contexts/TeamContext";
import { getSupabase } from "@/lib/supabase/client";
import type { Owner, TeamMember } from "@/lib/types";

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

          {/* Equipe */}
          <EquipeCard />

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

function EquipeCard() {
  const { sdrs, closers, addMember, deactivateMember } = useTeamContext();
  const [name, setName] = useState("");
  const [role, setRole] = useState<Owner>("SDR");
  const [saving, setSaving] = useState(false);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    const n = name.trim();
    if (!n || saving) return;
    setSaving(true);
    try {
      await addMember(n, role);
      setName("");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card title="Equipe" subtitle="Quem aparece como SDR e Closer nos formulários do CRM">
      <div className="space-y-4">
        <TeamGroup label="SDR" members={sdrs} onRemove={deactivateMember} color="text-sky-300" />
        <TeamGroup label="Closer" members={closers} onRemove={deactivateMember} color="text-fuchsia-300" />

        <form
          onSubmit={handleAdd}
          className="flex flex-wrap items-center gap-2 border-t border-zinc-900 pt-4"
        >
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nome do membro"
            className="min-w-[140px] flex-1 rounded-md border border-zinc-800 bg-[#0f1218] px-3 py-2 text-sm text-zinc-100 outline-none focus:border-[#f5c518]"
          />
          <div className="flex rounded-md border border-zinc-800 bg-zinc-900 p-0.5 text-xs">
            {(["SDR", "Closer"] as Owner[]).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRole(r)}
                className={`rounded px-3 py-1 transition-colors ${
                  role === r
                    ? "bg-[#f5c518] font-semibold text-zinc-950"
                    : "text-zinc-400 hover:text-zinc-200"
                }`}
              >
                {r}
              </button>
            ))}
          </div>
          <button
            type="submit"
            disabled={saving || !name.trim()}
            className="rounded-md bg-[#f5c518] px-4 py-2 text-sm font-semibold text-zinc-950 hover:bg-[#ffd633] disabled:opacity-50"
          >
            Adicionar
          </button>
        </form>
      </div>
    </Card>
  );
}

function TeamGroup({
  label, members, onRemove, color,
}: {
  label: string;
  members: TeamMember[];
  onRemove: (id: string) => void | Promise<void>;
  color: string;
}) {
  return (
    <div>
      <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
        {label}
      </div>
      {members.length === 0 ? (
        <p className="text-xs text-zinc-600">Ninguém cadastrado.</p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {members.map((m) => (
            <span
              key={m.id}
              className={`inline-flex items-center gap-1.5 rounded-md border border-zinc-800 bg-zinc-900 px-2.5 py-1 text-xs ${color}`}
            >
              {m.name}
              <button
                type="button"
                onClick={() => {
                  if (confirm(`Remover ${m.name} da equipe?`)) onRemove(m.id);
                }}
                className="text-zinc-600 hover:text-rose-400"
                title="Remover"
              >
                <X size={12} />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
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
