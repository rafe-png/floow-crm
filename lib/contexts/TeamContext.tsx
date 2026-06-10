"use client";

import { createContext, useCallback, useContext, useMemo } from "react";
import { useAuth } from "@/lib/hooks/useAuth";
import { useTeamMembers } from "@/lib/hooks/useTeam";
import { isAdminEmail, type Owner, type TeamMember } from "@/lib/types";

type TeamContextValue = {
  members: TeamMember[];
  loading: boolean;
  sdrs: TeamMember[];
  closers: TeamMember[];
  /** Email da sessão atual */
  currentEmail: string | null;
  /** True só pro admin do CRM (rafe@floowdigital.com) */
  isAdmin: boolean;
  /** Membro correspondente ao usuário logado (lookup por email) */
  currentMember: TeamMember | null;
  /**
   * Default pra autocompletar nos formulários.
   * Se o usuário logado é SDR → defaultFor('SDR') retorna ele mesmo.
   * Senão retorna o primeiro SDR cadastrado. Mesmo pra Closer.
   */
  defaultFor: (role: Owner) => TeamMember | null;
  /** Adiciona um membro (aparece na hora via realtime) */
  addMember: (name: string, role: Owner) => Promise<void>;
  /** Desativa um membro (some das listas, sem apagar histórico) */
  deactivateMember: (id: string) => Promise<void>;
  /** [admin] Cria usuário com conta de login (email + senha temporária) */
  createUser: (input: { name: string; email: string; password: string; role: Owner }) => Promise<void>;
  /** [admin] Remove o usuário: desativa no time e apaga o login */
  removeUser: (member: TeamMember) => Promise<void>;
};

const TeamContext = createContext<TeamContextValue | null>(null);

export function TeamProvider({ children }: { children: React.ReactNode }) {
  const { members, loading, addMember, deactivateMember } = useTeamMembers();
  const { user } = useAuth();

  const createUser = useCallback(
    async (input: { name: string; email: string; password: string; role: Owner }) => {
      const res = await fetch("/api/team/create-user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Erro ao criar usuário.");
      }
    },
    [],
  );

  const removeUser = useCallback(async (member: TeamMember) => {
    const res = await fetch("/api/team/delete-user", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: member.id, email: member.email }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error ?? "Erro ao remover usuário.");
    }
  }, []);

  const value = useMemo<TeamContextValue>(() => {
    const sdrs = members.filter((m) => m.role === "SDR");
    const closers = members.filter((m) => m.role === "Closer");
    const currentEmail = user?.email ?? null;
    const currentMember =
      currentEmail ? members.find((m) => m.email?.toLowerCase() === currentEmail.toLowerCase()) ?? null : null;

    return {
      members,
      loading,
      sdrs,
      closers,
      currentEmail,
      isAdmin: isAdminEmail(currentEmail),
      currentMember,
      defaultFor: (role) => {
        if (currentMember && currentMember.role === role) return currentMember;
        return (role === "SDR" ? sdrs[0] : closers[0]) ?? null;
      },
      addMember,
      deactivateMember,
      createUser,
      removeUser,
    };
  }, [members, loading, user, addMember, deactivateMember, createUser, removeUser]);

  return <TeamContext.Provider value={value}>{children}</TeamContext.Provider>;
}

export function useTeamContext(): TeamContextValue {
  const ctx = useContext(TeamContext);
  if (!ctx) throw new Error("useTeamContext deve estar dentro de <TeamProvider>");
  return ctx;
}
