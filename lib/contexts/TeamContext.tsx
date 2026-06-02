"use client";

import { createContext, useContext, useMemo } from "react";
import { useAuth } from "@/lib/hooks/useAuth";
import { useTeamMembers } from "@/lib/hooks/useTeam";
import type { Owner, TeamMember } from "@/lib/types";

type TeamContextValue = {
  members: TeamMember[];
  loading: boolean;
  sdrs: TeamMember[];
  closers: TeamMember[];
  /** Membro correspondente ao usuário logado (lookup por email) */
  currentMember: TeamMember | null;
  /**
   * Default pra autocompletar nos formulários.
   * Se o usuário logado é SDR → defaultFor('SDR') retorna ele mesmo.
   * Senão retorna o primeiro SDR cadastrado. Mesmo pra Closer.
   */
  defaultFor: (role: Owner) => TeamMember | null;
};

const TeamContext = createContext<TeamContextValue | null>(null);

export function TeamProvider({ children }: { children: React.ReactNode }) {
  const { members, loading } = useTeamMembers();
  const { user } = useAuth();

  const value = useMemo<TeamContextValue>(() => {
    const sdrs = members.filter((m) => m.role === "SDR");
    const closers = members.filter((m) => m.role === "Closer");
    const currentMember =
      user?.email ? members.find((m) => m.email?.toLowerCase() === user.email?.toLowerCase()) ?? null : null;

    return {
      members,
      loading,
      sdrs,
      closers,
      currentMember,
      defaultFor: (role) => {
        if (currentMember && currentMember.role === role) return currentMember;
        return (role === "SDR" ? sdrs[0] : closers[0]) ?? null;
      },
    };
  }, [members, loading, user]);

  return <TeamContext.Provider value={value}>{children}</TeamContext.Provider>;
}

export function useTeamContext(): TeamContextValue {
  const ctx = useContext(TeamContext);
  if (!ctx) throw new Error("useTeamContext deve estar dentro de <TeamProvider>");
  return ctx;
}
